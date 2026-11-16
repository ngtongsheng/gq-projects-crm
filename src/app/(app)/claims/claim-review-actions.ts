"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { CLAIM_STATUSES, canAdjustClaim } from "@/lib/domain/claim-flow";
import {
  AdjustmentReason,
  AmountField,
  type PlannedChange,
  planAdjustments,
  type ReviewLine,
  ReviewRemark,
} from "@/lib/domain/claim-review";
import { sumRm } from "@/lib/format/money";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";

export type ClaimReviewResult = { error: string | null };

const NOT_FOUND = "Could not find that claim. Reload the page.";
const NOT_ALLOWED =
  "Only HR & Accounts or the MD changes a claim while it is submitted or checked, and never their own.";
const MOVED_ON =
  "This claim has moved on since you opened it. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const review = z.object({
  lines: z
    .array(
      z.object({
        // A commission line is named by its order, an expense by its own id, OT by the claim's.
        kind: z.enum(["commission", "expense", "ot"]),
        id: z.uuid(),
        amount: AmountField,
      }),
    )
    .max(300),
  reason: AdjustmentReason,
  remark: ReviewRemark,
  originalReceiptsReceived: z.boolean(),
});
export type ClaimReviewInput = z.input<typeof review>;

const claimRow = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  status: z.enum(CLAIM_STATUSES),
  remark: z.string(),
  original_receipts_received: z.boolean(),
  ot_original_amount: z.coerce.number().nullable(),
  ot_amount: z.coerce.number().nullable(),
});

const lineRows = z.array(
  z.object({
    key: z.uuid(),
    amount: z.coerce.number(),
    original_amount: z.coerce.number(),
  }),
);

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function openReview(claimId: string, supabase: Supabase) {
  const me = await requirePage("claims");
  const id = z.uuid().safeParse(claimId);
  if (!id.success) return { error: NOT_FOUND } as const;
  const { data, error } = await supabase
    .from("monthly_claims")
    .select(
      "id, profile_id, status, remark, original_receipts_received, ot_original_amount, ot_amount",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    logServerError("Could not load the monthly claim", error, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN } as const;
  }
  if (!data) return { error: NOT_FOUND } as const;
  const claim = claimRow.parse(data);
  if (
    !canAdjustClaim(me, { profileId: claim.profile_id, status: claim.status })
  ) {
    return { error: NOT_ALLOWED } as const;
  }
  return { error: null, me, claim } as const;
}

async function loadLines(
  supabase: Supabase,
  table: "monthly_claim_commissions" | "monthly_claim_expenses",
  kind: "commission" | "expense",
  claimId: string,
): Promise<ReviewLine[]> {
  const { data, error } = await supabase
    .from(table)
    .select(`key:${KEY_COLUMN[kind]}, amount, original_amount`)
    .eq("claim_id", claimId);
  if (error)
    throw new Error(`Could not load the claim lines: ${error.message}`);
  return lineRows.parse(data).map((row) => ({
    kind,
    id: row.key,
    amount: row.amount,
    originalAmount: row.original_amount,
  }));
}

const TABLE = {
  commission: "monthly_claim_commissions",
  expense: "monthly_claim_expenses",
} as const;

// One commission line per order in a claim (unique claim_id, mof_id).
const KEY_COLUMN = { commission: "mof_id", expense: "id" } as const;

async function applyLineChange(
  supabase: Supabase,
  claimId: string,
  change: PlannedChange & { kind: "commission" | "expense" },
) {
  const { data, error } = await supabase
    .from(TABLE[change.kind])
    .update({ amount: change.amount, adjustment_reason: change.reason })
    .eq(KEY_COLUMN[change.kind], change.id)
    .eq("claim_id", claimId)
    .select("claim_id");
  if (error) return error;
  return data.length === 0 ? { code: "moved", message: MOVED_ON } : null;
}

/**
 * Saves what the checker changed on a claim that is with them (demo clSaveAdj): line amounts
 * and the OT amount with the reason the person will read, the remark, and whether the
 * original receipts arrived. The claimed amounts stay in original_amount.
 */
export async function saveClaimReview(
  claimId: string,
  input: ClaimReviewInput,
): Promise<ClaimReviewResult> {
  const supabase = await createClient();
  const opened = await openReview(claimId, supabase);
  if (opened.error !== null) return { error: opened.error };
  const { me, claim } = opened;
  const parsed = review.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? TRY_AGAIN };
  }
  const { lines, reason, remark, originalReceiptsReceived } = parsed.data;

  const [commissions, expenses] = await Promise.all([
    loadLines(supabase, TABLE.commission, "commission", claim.id),
    loadLines(supabase, TABLE.expense, "expense", claim.id),
  ]);
  const ot: ReviewLine[] =
    claim.ot_amount !== null && claim.ot_original_amount !== null
      ? [
          {
            kind: "ot",
            id: claim.id,
            amount: claim.ot_amount,
            originalAmount: claim.ot_original_amount,
          },
        ]
      : [];
  const plan = planAdjustments(
    [...commissions, ...expenses, ...ot],
    lines.map((line) => ({
      ...line,
      id: line.kind === "ot" ? claim.id : line.id,
    })),
    reason,
  );
  if (plan.error !== null) return { error: plan.error };

  const claimChanges: Record<string, unknown> = {};
  if (remark !== claim.remark) claimChanges.remark = remark;
  if (originalReceiptsReceived !== claim.original_receipts_received) {
    claimChanges.original_receipts_received = originalReceiptsReceived;
  }
  for (const change of plan.changes) {
    if (change.kind === "ot") {
      claimChanges.ot_amount = change.amount;
      claimChanges.ot_adjustment_reason = change.reason;
    }
  }

  for (const change of plan.changes) {
    if (change.kind === "ot") continue;
    const failed = await applyLineChange(supabase, claim.id, {
      ...change,
      kind: change.kind,
    });
    if (failed) return saveFailed(failed, me.id, claim.id);
  }
  if (Object.keys(claimChanges).length > 0) {
    const { data, error } = await supabase
      .from("monthly_claims")
      .update(claimChanges)
      .eq("id", claim.id)
      .eq("status", claim.status)
      .select("id");
    if (error) return saveFailed(error, me.id, claim.id);
    if (data.length === 0) return { error: MOVED_ON };
  }
  revalidatePath("/claims", "layout");
  return { error: null };
}

function saveFailed(
  error: { code?: string; message: string },
  profileId: string,
  claimId: string,
) {
  if (error.code === "moved") return { error: MOVED_ON };
  if (error.code === "42501") return { error: NOT_ALLOWED };
  logServerError("Could not save the claim review", error, {
    profileId,
    recordId: claimId,
  });
  return { error: TRY_AGAIN };
}

const WAIVED_REASON = "Late-collection cut waived (special approval)";

const waiveLine = z.object({
  mof_id: z.uuid(),
  profile_id: z.uuid(),
  late_cut_amount: z.coerce.number(),
  original_amount: z.coerce.number(),
  amount: z.coerce.number(),
});

/**
 * Gives back the late-collection cut on the order's commission line when the person's appeal was
 * approved after the line was added (demo favour). Only the amount is a checker's to change,
 * so the line goes to what was payable plus the cut taken; the database's payout cap at
 * approval still holds it to what is payable now.
 */
export async function waiveLateCut(
  claimId: string,
  mofId: string,
): Promise<ClaimReviewResult> {
  const supabase = await createClient();
  const opened = await openReview(claimId, supabase);
  if (opened.error !== null) return { error: opened.error };
  const mof = z.uuid().safeParse(mofId);
  if (!mof.success) return { error: NOT_FOUND };

  const { data, error } = await supabase
    .from("monthly_claim_commissions")
    .select("mof_id, profile_id, late_cut_amount, original_amount, amount")
    .eq("mof_id", mof.data)
    .eq("claim_id", opened.claim.id)
    .maybeSingle();
  if (error) {
    logServerError("Could not load the commission line", error, {
      profileId: opened.me.id,
      recordId: mof.data,
    });
    return { error: TRY_AGAIN };
  }
  if (!data) return { error: NOT_FOUND };
  const row = waiveLine.parse(data);
  if (row.late_cut_amount <= 0) {
    return { error: "There is no late-collection cut on this line." };
  }

  const approved = await supabase
    .from("commission_appeals")
    .select("id")
    .eq("mof_id", row.mof_id)
    .eq("profile_id", row.profile_id)
    .eq("status", "approved")
    .limit(1);
  if (approved.error) {
    logServerError("Could not load the appeal", approved.error, {
      profileId: opened.me.id,
      recordId: row.mof_id,
    });
    return { error: TRY_AGAIN };
  }
  if (approved.data.length === 0) {
    return {
      error:
        "There is no approved special approval for this order. Decide the appeal on the Appeals tab first.",
    };
  }

  const failed = await applyLineChange(supabase, opened.claim.id, {
    kind: "commission",
    id: mof.data,
    amount: sumRm([row.original_amount, row.late_cut_amount]),
    reason: WAIVED_REASON,
  });
  if (failed) {
    return saveFailed(failed, opened.me.id, opened.claim.id);
  }
  revalidatePath("/claims", "layout");
  return { error: null };
}
