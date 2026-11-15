"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { seesMofCost } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { copyLines, type DbError, firstError } from "./copy-lines";
import {
  loadRevisionToEdit,
  NOT_FOUND,
  type RevisionToEdit,
  TRY_AGAIN,
} from "./revision-guard";
import {
  itemColumns,
  RevisionInput,
  type RevisionPayload,
  sellSideColumns,
  withoutCost,
} from "./revision-input";

export type RevisionResult = { error: string | null };
export type AddOptionResult = RevisionResult & { optionKey?: string };

const fail = (error: string): RevisionResult => ({ error });

const CHANGED_UNDER_YOU =
  "This costing can't be changed any more. Reload the page.";
const NOT_VALID =
  "Some entries are not valid. Check the numbers and try again.";
const COST_ONLY_KIND =
  "Only people who see cost can change what kind of line this is.";
const MOST_OPTIONS = "A costing has at most 26 options.";
const LAST_OPTION = "A costing keeps at least one option.";

/** A plain message for a refusal from the database; anything else is logged. */
function dbMessage(error: DbError): string {
  if (error.code === "42501") return CHANGED_UNDER_YOU;
  console.error("Could not save the costing", error);
  return TRY_AGAIN;
}

const letter = (index: number) => String.fromCharCode(65 + index);

function revalidateCosting(quoteId: string) {
  revalidatePath(`/costing/${quoteId}`);
  revalidatePath("/costing");
}

/**
 * Saves what the editor shows. Sell, cost and margin are not accepted: only keyed-in fields are
 * written, and the totals are worked out again when the costing loads (loop 13 D2). People without
 * the margin flag change sell-side fields only; the cost columns, rates and settings stay as the
 * flag holder keyed them (D3).
 */
export async function saveRevision(
  payload: RevisionPayload,
): Promise<RevisionResult> {
  const me = await requirePage("cost");
  const parsed = RevisionInput.safeParse(payload);
  if (!parsed.success) return fail(NOT_VALID);
  const input = parsed.data;

  const supabase = await createClient();
  const loaded = await loadRevisionToEdit(supabase, me.id, input.revisionId);
  if (loaded.error !== undefined) return fail(loaded.error);
  const { revision } = loaded;
  const seesCost = await seesMofCost(me);

  const refs = new Set<string>();
  const savedIds = new Map<string, string>();
  const keptIds = new Set<string>();
  for (const option of input.options) {
    const current = revision.options.find((known) => known.id === option.id);
    if (!current) return fail(NOT_FOUND);
    const knownTypes = new Map(current.items.map((i) => [i.id, i.type]));
    for (const item of option.items) {
      if (refs.has(item.ref)) return fail(NOT_VALID);
      refs.add(item.ref);
      if (item.id === null) continue;
      const knownType = knownTypes.get(item.id);
      if (knownType === undefined || keptIds.has(item.id)) {
        return fail(NOT_FOUND);
      }
      if (!seesCost && knownType !== item.type) return fail(COST_ONLY_KIND);
      keptIds.add(item.id);
      savedIds.set(item.ref, item.id);
    }
  }
  const removedIds = input.options.flatMap((option) =>
    (revision.options.find((known) => known.id === option.id)?.items ?? [])
      .map((item) => item.id)
      .filter((id) => !keptIds.has(id)),
  );

  // Touching the revision keeps "updated" honest even when only lines changed.
  const settings = seesCost ? settingsColumns(input) : {};
  const touched = await supabase
    .from("quote_revisions")
    .update({ status: revision.status, ...settings })
    .eq("id", revision.id);
  if (touched.error) return fail(dbMessage(touched.error));

  const prepared = await Promise.all([
    ...input.options.map((option) =>
      supabase
        .from("quote_options")
        .update({ label: option.label ?? "" })
        .eq("id", option.id),
    ),
    ...(removedIds.length > 0
      ? [supabase.from("quote_items").delete().in("id", removedIds)]
      : []),
  ]);
  const prepareError = firstError(prepared);
  if (prepareError) return fail(dbMessage(prepareError));

  const newIds = new Map<string, string>();
  const writes = await Promise.all(
    input.options.flatMap((option) =>
      option.items.map(async (item, position) => {
        const columns = itemColumns(seesCost ? item : withoutCost(item));
        const linked =
          item.type === "labour" && item.linkRef
            ? (savedIds.get(item.linkRef) ?? null)
            : null;
        if (item.id !== null) {
          const changes = seesCost ? columns : sellSideColumns(columns);
          return supabase
            .from("quote_items")
            .update({ ...changes, position, linked_item_id: linked })
            .eq("id", item.id);
        }
        const added = await supabase
          .from("quote_items")
          .insert({
            ...columns,
            option_id: option.id,
            position,
            linked_item_id: linked,
          })
          .select("id")
          .single();
        if (!added.error) {
          newIds.set(
            item.ref,
            z.object({ id: z.string() }).parse(added.data).id,
          );
        }
        return added;
      }),
    ),
  );
  const writeError = firstError(writes);
  if (writeError) return fail(dbMessage(writeError));

  // An installation line that follows a line added in the same save can only be linked now.
  const links = await Promise.all(
    input.options.flatMap((option) =>
      option.items.flatMap((item) => {
        if (item.type !== "labour" || !item.linkRef) return [];
        if (savedIds.has(item.linkRef)) return [];
        const target = newIds.get(item.linkRef);
        const own = item.id ?? newIds.get(item.ref);
        if (!target || !own) return [];
        return [
          supabase
            .from("quote_items")
            .update({ linked_item_id: target })
            .eq("id", own),
        ];
      }),
    ),
  );
  const linkError = firstError(links);
  if (linkError) return fail(dbMessage(linkError));

  const logError = await logEditAfterSubmit(supabase, revision);
  if (logError) return fail(dbMessage(logError));

  revalidateCosting(revision.quoteId);
  return { error: null };
}

function settingsColumns(input: z.infer<typeof RevisionInput>) {
  const columns: Record<string, number> = {};
  if (input.fxUsd !== null) columns.fx_usd = input.fxUsd;
  if (input.fxRmb !== null) columns.fx_rmb = input.fxRmb;
  if (input.sstPct !== null) columns.sst_pct = input.sstPct;
  if (input.targetMarginPct !== null) {
    columns.target_margin_pct = input.targetMarginPct;
  }
  return columns;
}

/** The approvers should see that a submitted costing changed; one line per submission is enough. */
async function logEditAfterSubmit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revision: RevisionToEdit,
): Promise<DbError | null> {
  if (revision.status !== "submitted") return null;
  const latest = await supabase
    .from("quote_revision_history")
    .select("action")
    .eq("revision_id", revision.id)
    .in("action", ["submitted", "edited"])
    .order("at", { ascending: false })
    .limit(1);
  if (latest.error) return latest.error;
  const last = z
    .array(z.object({ action: z.string() }))
    .parse(latest.data)[0]?.action;
  if (last !== "submitted") return null;
  const logged = await supabase.from("quote_revision_history").insert({
    revision_id: revision.id,
    action: "edited",
    note: "Changed after it was submitted",
  });
  return logged.error;
}

const addOptionInput = z.object({
  revisionId: z.uuid(),
  /** The option whose lines are copied into the new one; null starts it empty. */
  copyFromOptionId: z.uuid().nullable(),
});

/** Adds the next option (A, B, C...), as a copy of one option or empty. Saves nothing else. */
export async function addOption(
  input: z.input<typeof addOptionInput>,
): Promise<AddOptionResult> {
  const me = await requirePage("cost");
  const parsed = addOptionInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  const { revisionId, copyFromOptionId } = parsed.data;

  const supabase = await createClient();
  const loaded = await loadRevisionToEdit(supabase, me.id, revisionId);
  if (loaded.error !== undefined) return fail(loaded.error);
  const { revision } = loaded;
  if (revision.options.length >= 26) return fail(MOST_OPTIONS);
  if (
    copyFromOptionId !== null &&
    !revision.options.some((option) => option.id === copyFromOptionId)
  ) {
    return fail(NOT_FOUND);
  }

  const taken = new Set(revision.options.map((option) => option.key));
  const key = Array.from({ length: 26 }, (_, index) => letter(index)).find(
    (candidate) => !taken.has(candidate),
  );
  if (!key) return fail(MOST_OPTIONS);

  const added = await supabase
    .from("quote_options")
    .insert({ revision_id: revision.id, key, label: "" })
    .select("id")
    .single();
  if (added.error) return fail(dbMessage(added.error));
  const optionId = z.object({ id: z.string() }).parse(added.data).id;

  if (copyFromOptionId !== null) {
    const copyError = await copyLines(supabase, copyFromOptionId, optionId);
    if (copyError) return fail(dbMessage(copyError));
  }
  revalidateCosting(revision.quoteId);
  return { error: null, optionKey: key };
}

const removeOptionInput = z.object({ optionId: z.uuid() });

/** Removes an option with its lines and re-letters the rest so the letters have no gap. */
export async function removeOption(
  input: z.input<typeof removeOptionInput>,
): Promise<RevisionResult> {
  const me = await requirePage("cost");
  const parsed = removeOptionInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  const supabase = await createClient();

  const found = await supabase
    .from("quote_options")
    .select("revision_id")
    .eq("id", parsed.data.optionId)
    .maybeSingle();
  if (found.error) return fail(dbMessage(found.error));
  if (!found.data) return fail(NOT_FOUND);
  const revisionId = z
    .object({ revision_id: z.string() })
    .parse(found.data).revision_id;

  const loaded = await loadRevisionToEdit(supabase, me.id, revisionId);
  if (loaded.error !== undefined) return fail(loaded.error);
  const { revision } = loaded;
  if (revision.options.length <= 1) return fail(LAST_OPTION);

  const removed = await supabase
    .from("quote_options")
    .delete()
    .eq("id", parsed.data.optionId);
  if (removed.error) return fail(dbMessage(removed.error));

  // One at a time, in order: each new letter is free by the time it is taken.
  const remaining = revision.options.filter(
    (option) => option.id !== parsed.data.optionId,
  );
  for (const [index, option] of remaining.entries()) {
    if (option.key === letter(index)) continue;
    const renamed = await supabase
      .from("quote_options")
      .update({ key: letter(index) })
      .eq("id", option.id);
    if (renamed.error) return fail(dbMessage(renamed.error));
  }
  revalidateCosting(revision.quoteId);
  return { error: null };
}

const startRevisionInput = z.object({ quoteId: z.uuid() });

/**
 * Creates the Original draft revision for a quote that has none, which is what is left when
 * starting the costing failed midway (createQuote does its inserts one after another).
 */
export async function startOriginalRevision(
  input: z.input<typeof startRevisionInput>,
): Promise<RevisionResult> {
  await requirePage("cost");
  const parsed = startRevisionInput.safeParse(input);
  if (!parsed.success) return fail(NOT_VALID);
  const { quoteId } = parsed.data;
  const supabase = await createClient();

  const revision = await supabase
    .from("quote_revisions")
    .insert({ quote_id: quoteId, rev: 0, status: "draft" })
    .select("id")
    .single();
  if (revision.error) {
    // The Original already exists, so there is nothing to create.
    if (revision.error.code === "23505") return { error: null };
    return fail(dbMessage(revision.error));
  }
  const revisionId = z.object({ id: z.string() }).parse(revision.data).id;

  const written = await Promise.all([
    supabase
      .from("quote_options")
      .insert({ revision_id: revisionId, key: "A", label: "" }),
    supabase
      .from("quote_revision_history")
      .insert({ revision_id: revisionId, action: "created" }),
  ]);
  const writeError = firstError(written);
  if (writeError) return fail(dbMessage(writeError));

  revalidateCosting(quoteId);
  return { error: null };
}
