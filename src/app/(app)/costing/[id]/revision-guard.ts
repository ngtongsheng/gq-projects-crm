import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { ItemType, QuoteStatus } from "../quote-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const revisionRow = z.object({
  id: z.string(),
  quote_id: z.string(),
  status: QuoteStatus,
  quotes: z.object({ salesperson_id: z.string() }),
  quote_options: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      quote_items: z.array(z.object({ id: z.string(), type: ItemType })),
    }),
  ),
});

export type RevisionToEdit = {
  id: string;
  quoteId: string;
  status: QuoteStatus;
  options: {
    id: string;
    key: string;
    items: { id: string; type: z.infer<typeof ItemType> }[];
  }[];
};

export const NOT_FOUND = "Could not find this costing. Reload the page.";
export const NOT_OWNER =
  "Only the salesperson who owns this costing can change it.";
export const LOCKED =
  "An approved costing is locked. Open a new revision to change it.";
export const TRY_AGAIN =
  "Could not save. Reload the page and try again; some changes may not have saved.";

type Loaded =
  | { revision: RevisionToEdit; error?: undefined }
  | { error: string };

/**
 * The revision with its options and lines, when this person may change it: they own the quote
 * and the revision is not approved. Otherwise the plain message to show. The database enforces
 * the same rules; checking here gives a clear message instead of a refusal halfway through.
 */
export async function loadRevisionToEdit(
  supabase: Supabase,
  personId: string,
  revisionId: string,
): Promise<Loaded> {
  const { data, error } = await supabase
    .from("quote_revisions")
    .select(
      "id, quote_id, status, quotes(salesperson_id), quote_options(id, key, quote_items(id, type))",
    )
    .eq("id", revisionId)
    .maybeSingle();
  if (error) {
    console.error("Could not load the revision to edit", error);
    return { error: TRY_AGAIN };
  }
  if (!data) return { error: NOT_FOUND };
  const row = revisionRow.parse(data);
  if (row.quotes.salesperson_id !== personId) return { error: NOT_OWNER };
  if (row.status === "approved") return { error: LOCKED };
  return {
    revision: {
      id: row.id,
      quoteId: row.quote_id,
      status: row.status,
      options: [...row.quote_options]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((option) => ({
          id: option.id,
          key: option.key,
          items: option.quote_items,
        })),
    },
  };
}
