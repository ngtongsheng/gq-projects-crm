"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import {
  CLAIM_STATUSES,
  type ClaimStep,
  canTakeStep,
  flagRemarkBlock,
  lastMonthOf,
  payReportBlock,
  receiptsBlock,
  STATUS_AFTER,
  submitReportBlock,
  submittedAfterCutOff,
} from "@/lib/domain/claim-flow";
import { reportKindFor } from "@/lib/domain/report-stats";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadReportFilers } from "../reports/report-filers";
import { loadClaimFlagCount } from "./claim-review-flags";
import { loadClaimSettings } from "./claim-settings-data";

export type ClaimStepResult = { error: string | null };
export type SubmitClaimResult = ClaimStepResult & { afterCutOff: boolean };

const NOT_FOUND = "Could not find that claim. Reload the page.";
const MOVED_ON =
  "This claim has moved on since you opened it. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";
const NOT_ALLOWED: Record<ClaimStep, string> = {
  submit:
    "Only the person can submit their claim, while it is a draft or returned.",
  check: "Only HR & Accounts checks a submitted claim, and never their own.",
  approve:
    "Only HR & Accounts or the MD approves a claim, and never their own.",
  return: "Only HR & Accounts or the MD returns a claim, and never their own.",
  pay: "Only HR & Accounts marks an approved claim paid, and never their own.",
};

const claimRow = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  month: z.iso.date(),
  status: z.enum(CLAIM_STATUSES),
  original_receipts_received: z.boolean(),
  remark: z.string(),
});
type ClaimRow = z.infer<typeof claimRow>;

const reportRow = z
  .object({ status: z.enum(["draft", "submitted", "reviewed", "approved"]) })
  .nullable();

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The claim and the signed-in person, when they may take this step on it. */
async function openStep(
  step: ClaimStep,
  claimId: string,
): Promise<
  | { error: string }
  | { error: null; me: Profile; claim: ClaimRow; supabase: Supabase }
> {
  const me = await requirePage("claims");
  const id = z.uuid().safeParse(claimId);
  if (!id.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select("id, profile_id, month, status, original_receipts_received, remark")
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    console.error("Could not load the monthly claim", error);
    return { error: TRY_AGAIN };
  }
  if (!data) return { error: NOT_FOUND };
  const claim = claimRow.parse(data);
  if (
    !canTakeStep(step, me, {
      profileId: claim.profile_id,
      status: claim.status,
    })
  ) {
    return { error: NOT_ALLOWED[step] };
  }
  return { error: null, me, claim, supabase };
}

/** Moves the claim on, only from the status it was read in; every change is logged by the database. */
async function moveClaim(
  supabase: Supabase,
  step: ClaimStep,
  claim: ClaimRow,
  extra: Record<string, unknown> = {},
): Promise<ClaimStepResult> {
  const { data, error } = await supabase
    .from("monthly_claims")
    .update({ status: STATUS_AFTER[step], ...extra })
    .eq("id", claim.id)
    .eq("status", claim.status)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED[step] };
    if (error.code === "23505") {
      return {
        error:
          "A commission line here is already in another claim waiting to be paid. Remove it, then submit.",
      };
    }
    console.error(`Could not ${step} the monthly claim`, error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: MOVED_ON };
  revalidatePath("/claims");
  return { error: null };
}

async function reportStatus(
  supabase: Supabase,
  profileId: string,
  month: string,
) {
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("status")
    .eq("profile_id", profileId)
    .eq("month", month)
    .maybeSingle();
  if (error)
    throw new Error(`Could not load the monthly report: ${error.message}`);
  return reportRow.parse(data)?.status ?? null;
}

async function lineCount(
  supabase: Supabase,
  table: "monthly_claim_commissions" | "monthly_claim_expenses",
  claimId: string,
  withReceipt = false,
): Promise<number> {
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("claim_id", claimId);
  if (withReceipt) query = query.not("receipt_path", "is", null);
  const { count, error } = await query;
  if (error)
    throw new Error(`Could not count the claim lines: ${error.message}`);
  return count ?? 0;
}

/** A flagged claim needs the checker's remark first. Counting the flags is only done when there is no remark yet. */
async function remarkBlock(
  step: ClaimStep,
  claim: ClaimRow,
): Promise<string | null> {
  if (claim.remark.trim() !== "") return null;
  return flagRemarkBlock({
    step,
    flagCount: await loadClaimFlagCount({
      id: claim.id,
      profileId: claim.profile_id,
      month: claim.month,
    }),
    remark: claim.remark,
  });
}

/**
 * Submits the person's own claim (D1) once last month's report is in (D6 needRep), freezing
 * section C at the month's approved OT. A claim with nothing in it is not submitted.
 */
export async function submitClaim(claimId: string): Promise<SubmitClaimResult> {
  const opened = await openStep("submit", claimId);
  if (opened.error !== null) return { error: opened.error, afterCutOff: false };
  const { me, claim, supabase } = opened;
  const settings = await loadClaimSettings();

  const reportKind = reportKindFor(me.jobRole);
  if (settings.needReport && reportKind) {
    const { data, error } = await supabase
      .from("profiles")
      .select("joined_on")
      .eq("id", me.id)
      .single();
    if (error) throw new Error(`Could not load your profile: ${error.message}`);
    const joinedOn = z
      .object({ joined_on: z.iso.date().nullable() })
      .parse(data).joined_on;
    const blocked = submitReportBlock({
      needReport: settings.needReport,
      claimMonth: claim.month,
      reportKind,
      joinedOn,
      lastMonthReport: await reportStatus(
        supabase,
        me.id,
        lastMonthOf(claim.month),
      ),
    });
    if (blocked) return { error: blocked, afterCutOff: false };
  }

  const { data: otAmount, error: otError } = await supabase.rpc(
    "monthly_claim_ot_amount",
    { claim: claim.id },
  );
  if (otError) {
    console.error("Could not work out the claim's OT amount", otError);
    return { error: TRY_AGAIN, afterCutOff: false };
  }
  const ot = z.coerce.number().nonnegative().parse(otAmount);
  const [commissions, expenses] = await Promise.all([
    lineCount(supabase, "monthly_claim_commissions", claim.id),
    lineCount(supabase, "monthly_claim_expenses", claim.id),
  ]);
  if (commissions + expenses === 0 && ot === 0) {
    return {
      error: "Nothing to claim yet. Add an expense, OT or commission first.",
      afterCutOff: false,
    };
  }

  const moved = await moveClaim(supabase, "submit", claim, {
    ot_original_amount: ot,
  });
  return {
    ...moved,
    afterCutOff:
      moved.error === null &&
      submittedAfterCutOff(claim.month, settings.cutOffDay, todayMyt()),
  };
}

/** HR & Accounts checks a submitted claim and passes it to the MD. */
export async function checkClaim(claimId: string): Promise<ClaimStepResult> {
  const opened = await openStep("check", claimId);
  if (opened.error !== null) return { error: opened.error };
  const { me, claim, supabase } = opened;

  const blocked = receiptsBlock({
    step: "check",
    jobRole: me.jobRole,
    receiptCount: await lineCount(
      supabase,
      "monthly_claim_expenses",
      claim.id,
      true,
    ),
    originalReceiptsReceived: claim.original_receipts_received,
  });
  if (blocked) return { error: blocked };
  const unexplained = await remarkBlock("check", claim);
  if (unexplained) return { error: unexplained };
  return moveClaim(supabase, "check", claim);
}

/**
 * HR & Accounts or the MD approves. The database records the commission lines as paid out in
 * the same step (approve_monthly_claim), so they cannot be claimed again.
 */
export async function approveClaim(claimId: string): Promise<ClaimStepResult> {
  const opened = await openStep("approve", claimId);
  if (opened.error !== null) return { error: opened.error };
  const { me, claim, supabase } = opened;

  const blocked = receiptsBlock({
    step: "approve",
    jobRole: me.jobRole,
    receiptCount: await lineCount(
      supabase,
      "monthly_claim_expenses",
      claim.id,
      true,
    ),
    originalReceiptsReceived: claim.original_receipts_received,
  });
  if (blocked) return { error: blocked };
  const unexplained = await remarkBlock("approve", claim);
  if (unexplained) return { error: unexplained };

  const { error } = await supabase.rpc("approve_monthly_claim", {
    claim: claim.id,
  });
  if (error) {
    if (error.code === "P0002") return { error: MOVED_ON };
    if (error.code === "42501") return { error: NOT_ALLOWED.approve };
    // The payout cap: something on the order was paid out since the line was added.
    if (error.code === "23514") {
      return {
        error: `${error.message} Adjust that commission line, then approve.`,
      };
    }
    console.error("Could not approve the monthly claim", error);
    return { error: TRY_AGAIN };
  }
  revalidatePath("/claims");
  revalidatePath("/commission");
  return { error: null };
}

const returnReason = z
  .string()
  .trim()
  .min(1, "Say what to fix.")
  .max(500, "Keep it under 500 characters.");

/** HR & Accounts or the MD sends a submitted or checked claim back with what to fix. */
export async function returnClaim(
  claimId: string,
  reason: string,
): Promise<ClaimStepResult> {
  const opened = await openStep("return", claimId);
  if (opened.error !== null) return { error: opened.error };
  const parsed = returnReason.safeParse(reason);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Say what to fix." };
  }
  return moveClaim(opened.supabase, "return", opened.claim, {
    return_reason: parsed.data,
  });
}

/** HR & Accounts marks an approved claim paid, once the claim month's report is approved (D6 clRepOk). */
export async function payClaim(claimId: string): Promise<ClaimStepResult> {
  const opened = await openStep("pay", claimId);
  if (opened.error !== null) return { error: opened.error };
  const { claim, supabase } = opened;

  const filer = (await loadReportFilers()).find(
    (person) => person.id === claim.profile_id,
  );
  const blocked = payReportBlock({
    claimMonth: claim.month,
    reportKind: filer?.kind ?? null,
    claimMonthReport: filer
      ? await reportStatus(supabase, claim.profile_id, claim.month)
      : null,
  });
  if (blocked) return { error: blocked };
  return moveClaim(supabase, "pay", claim);
}
