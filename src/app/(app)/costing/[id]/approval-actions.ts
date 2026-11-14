"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canApproveQuote } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { type ApprovalStep, decideStep } from "@/lib/domain/quote-status";
import { createClient } from "@/lib/supabase/server";
import {
  type ApprovalRevision,
  loadApprovalRevision,
} from "./approval-revision";
import { copyLines, type DbError, firstError } from "./copy-lines";
import { NOT_FOUND, TRY_AGAIN } from "./revision-guard";

export type ApprovalResult = { error: string | null };
export type OpenRevisionResult = ApprovalResult & { rev?: number };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const NOT_VALID = "Some entries are not valid. Reload the page and try again.";
const CHANGED_UNDER_YOU =
  "This costing changed while you had it open. Reload the page.";
const ALREADY_OPEN = "A new version was already opened. Reload the page.";

const fail = (error: string): ApprovalResult => ({ error });

const revisionName = (quoteNo: string, rev: number) =>
  rev > 0 ? `${quoteNo}-R${rev}` : quoteNo;

function dbMessage(error: DbError): string {
  if (error.code === "42501") return CHANGED_UNDER_YOU;
  console.error("Could not update the costing approval", error);
  return TRY_AGAIN;
}

type Loaded =
  | { revision: ApprovalRevision; error?: undefined }
  | { error: string };

async function load(supabase: Supabase, revisionId: string): Promise<Loaded> {
  try {
    const revision = await loadApprovalRevision(supabase, revisionId);
    return revision ? { revision } : { error: NOT_FOUND };
  } catch (error) {
    console.error("Could not load the costing for approval", error);
    return { error: TRY_AGAIN };
  }
}

/** Checks the step against the flow, then moves the revision on and records it in its history. */
async function moveRevision(
  step: Exclude<ApprovalStep, "revise">,
  revisionId: string,
  note: string,
  chosenOptionId?: string,
): Promise<ApprovalResult> {
  const me = await requirePage("cost");
  const supabase = await createClient();
  const loaded = await load(supabase, revisionId);
  if (loaded.error !== undefined) return fail(loaded.error);
  const { revision } = loaded;

  const chosen = revision.options.find(
    (option) => option.id === chosenOptionId,
  );
  if (step === "choose" && !chosen) return fail(NOT_FOUND);

  const outcome = decideStep(step, {
    status: revision.status,
    isOwner: revision.salespersonId === me.id,
    isApprover: canApproveQuote(me.jobRole),
    isLatest: revision.rev === revision.latestRev,
    note: chosen ? `Option ${chosen.key}` : note,
    readiness: revision.readiness,
  });
  if (!outcome.ok) return fail(outcome.error);

  // Only from the status just checked, so two people deciding at once cannot both win.
  const changes =
    step === "choose"
      ? { chosen_option_id: chosen?.id }
      : { status: outcome.status };
  const updated = await supabase
    .from("quote_revisions")
    .update(changes)
    .eq("id", revision.id)
    .eq("status", revision.status)
    .select("id");
  if (updated.error) return fail(dbMessage(updated.error));
  if (z.array(z.unknown()).parse(updated.data).length === 0) {
    return fail(CHANGED_UNDER_YOU);
  }

  const logged = await supabase.from("quote_revision_history").insert({
    revision_id: revision.id,
    action: outcome.history,
    note: outcome.note,
  });
  if (logged.error) return fail(dbMessage(logged.error));

  revalidateCosting(revision.quoteId);
  return { error: null };
}

function revalidateCosting(quoteId: string) {
  revalidatePath(`/costing/${quoteId}`);
  revalidatePath("/costing/approvals");
  revalidatePath("/costing");
}

const noteInput = z.object({
  revisionId: z.uuid(),
  note: z.string().max(1000),
});

/**
 * The owner's one button: a costing whose weakest option meets the minimum margin, with every
 * cost keyed in, becomes OK to quote; anything else needs a reason and goes to the MD or Sales
 * Director.
 */
export async function sendCosting(
  input: z.input<typeof noteInput>,
): Promise<ApprovalResult> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  return moveRevision("send", parsed.data.revisionId, parsed.data.note);
}

export async function approveCosting(
  input: z.input<typeof noteInput>,
): Promise<ApprovalResult> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  return moveRevision("approve", parsed.data.revisionId, parsed.data.note);
}

export async function returnCosting(
  input: z.input<typeof noteInput>,
): Promise<ApprovalResult> {
  const parsed = noteInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  return moveRevision("return", parsed.data.revisionId, parsed.data.note);
}

const chooseInput = z.object({ revisionId: z.uuid(), optionId: z.uuid() });

/** Records which option the customer took on a costing that is OK to quote. */
export async function chooseOption(
  input: z.input<typeof chooseInput>,
): Promise<ApprovalResult> {
  const parsed = chooseInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  return moveRevision(
    "choose",
    parsed.data.revisionId,
    "",
    parsed.data.optionId,
  );
}

const reviseInput = z.object({ revisionId: z.uuid() });

/**
 * Opens the next version (R1, R2...) as a draft copy of an approved one: its rates, options and
 * lines. Runs as several writes, like saving (docs/debt.md); a failure midway leaves a draft the
 * owner can finish by hand.
 */
export async function openRevision(
  input: z.input<typeof reviseInput>,
): Promise<OpenRevisionResult> {
  const me = await requirePage("cost");
  const parsed = reviseInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  const supabase = await createClient();
  const loaded = await load(supabase, parsed.data.revisionId);
  if (loaded.error !== undefined) return fail(loaded.error);
  const { revision } = loaded;

  const outcome = decideStep("revise", {
    status: revision.status,
    isOwner: revision.salespersonId === me.id,
    isApprover: canApproveQuote(me.jobRole),
    isLatest: revision.rev === revision.latestRev,
    note: `Copied from ${revisionName(revision.quoteNo, revision.rev)}`,
    readiness: revision.readiness,
  });
  if (!outcome.ok) return fail(outcome.error);

  const rev = revision.latestRev + 1;
  const created = await supabase
    .from("quote_revisions")
    .insert({
      quote_id: revision.quoteId,
      rev,
      status: outcome.status,
      ...revision.settings,
    })
    .select("id")
    .single();
  if (created.error) {
    if (created.error.code === "23505") return fail(ALREADY_OPEN);
    return fail(dbMessage(created.error));
  }
  const newId = z.object({ id: z.string() }).parse(created.data).id;

  const logged = await supabase.from("quote_revision_history").insert({
    revision_id: newId,
    action: outcome.history,
    note: outcome.note,
  });
  if (logged.error) return fail(dbMessage(logged.error));

  const copied = await Promise.all(
    revision.options.map(async (option) => {
      const added = await supabase
        .from("quote_options")
        .insert({ revision_id: newId, key: option.key, label: option.label })
        .select("id")
        .single();
      if (added.error) return { error: added.error };
      const optionId = z.object({ id: z.string() }).parse(added.data).id;
      return { error: await copyLines(supabase, option.id, optionId) };
    }),
  );
  const copyError = firstError(copied);
  if (copyError) return fail(dbMessage(copyError));

  revalidateCosting(revision.quoteId);
  return { error: null, rev };
}
