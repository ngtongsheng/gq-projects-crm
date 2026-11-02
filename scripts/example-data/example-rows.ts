import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExampleData } from "./dataset.ts";
import type { ExampleTable } from "./types.ts";

const CHUNK = 100;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK)
    out.push(items.slice(i, i + CHUNK));
  return out;
}

function keysToDelete(spec: ExampleTable): string[] {
  return spec.cleanupKeys ?? spec.rows.map((row) => String(row[spec.key]));
}

/** Deletes exactly the rows an earlier run made, children before parents. */
export async function removeExampleRows(
  supabase: SupabaseClient,
  data: ExampleData,
): Promise<void> {
  for (const spec of [...data.tables].reverse()) {
    for (const keys of chunks(keysToDelete(spec))) {
      const { error } = await supabase
        .from(spec.table)
        .delete()
        .in(spec.key, keys);
      if (error) {
        throw new Error(
          `Could not clear ${spec.table}: ${error.message}. If the team added records to example orders, remove those first.`,
        );
      }
    }
  }
}

/** Inserts every table in order, then completes the deliveries. Returns the row count per table. */
export async function insertExampleRows(
  supabase: SupabaseClient,
  data: ExampleData,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const spec of data.tables) {
    for (const rows of chunks(spec.rows)) {
      const { error } = await supabase.from(spec.table).insert(rows);
      if (error) {
        throw new Error(`Could not add ${spec.table}: ${error.message}`);
      }
    }
    counts[spec.table] = spec.rows.length;
  }

  if (data.deliveriesToFinish.length > 0) {
    const { error } = await supabase
      .from("jobs")
      .update({ status: "done" })
      .in("id", data.deliveriesToFinish);
    if (error) throw new Error(`Could not finish deliveries: ${error.message}`);
  }
  return counts;
}
