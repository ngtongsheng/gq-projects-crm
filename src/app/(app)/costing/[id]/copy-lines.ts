import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { ITEM_SELECT, quoteItemRow } from "../quote-view";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type DbError = { code?: string; message?: string };

export const firstError = (results: { error: DbError | null }[]) =>
  results.find((result) => result.error)?.error ?? null;

/** Copies an option's lines into another option, for a new option or a new version. */
export async function copyLines(
  supabase: Supabase,
  fromOptionId: string,
  toOptionId: string,
): Promise<DbError | null> {
  const source = await supabase
    .from("quote_items")
    .select(ITEM_SELECT)
    .eq("option_id", fromOptionId)
    .order("position");
  if (source.error) return source.error;
  const lines = z.array(quoteItemRow).parse(source.data);

  // Lines are copied without their links first; a link then points at the copy, not the original.
  const copies = new Map<string, string>();
  const inserted = await Promise.all(
    lines.map(async ({ id, linked_item_id: _link, ...columns }) => {
      const copy = await supabase
        .from("quote_items")
        .insert({ ...columns, option_id: toOptionId, linked_item_id: null })
        .select("id")
        .single();
      if (!copy.error) {
        copies.set(id, z.object({ id: z.string() }).parse(copy.data).id);
      }
      return copy;
    }),
  );
  const insertError = firstError(inserted);
  if (insertError) return insertError;

  const links = await Promise.all(
    lines.flatMap((line) => {
      const copyId = copies.get(line.id);
      const target = line.linked_item_id
        ? copies.get(line.linked_item_id)
        : undefined;
      if (!copyId || !target) return [];
      return [
        supabase
          .from("quote_items")
          .update({ linked_item_id: target })
          .eq("id", copyId),
      ];
    }),
  );
  return firstError(links);
}
