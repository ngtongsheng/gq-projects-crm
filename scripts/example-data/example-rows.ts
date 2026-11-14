import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExampleData } from "./dataset.ts";
import { EXAMPLE_REFERENCES } from "./table-references.ts";
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

const parentsOf = (table: string): Array<[string, string]> =>
  Object.entries(EXAMPLE_REFERENCES[table] ?? {});

const PARENT_TABLES = new Set(
  Object.values(EXAMPLE_REFERENCES).flatMap((links) => Object.values(links)),
);

async function deleteWhere(
  supabase: SupabaseClient,
  table: string,
  column: string,
  values: string[],
): Promise<void> {
  for (const keys of chunks(values)) {
    const { error } = await supabase.from(table).delete().in(column, keys);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }
}

/**
 * Ids of every row the reset removes from each parent table: the seeded rows plus
 * rows the team added in the app under them. Parents come first in `data.tables`.
 */
async function idsToClear(
  supabase: SupabaseClient,
  data: ExampleData,
): Promise<Map<string, string[]>> {
  const ids = new Map<string, string[]>();
  for (const spec of data.tables) {
    if (!PARENT_TABLES.has(spec.table)) continue;
    const found = new Set(
      spec.key === "id" ? spec.rows.map((row) => String(row.id)) : [],
    );
    for (const [column, parent] of parentsOf(spec.table)) {
      for (const keys of chunks(ids.get(parent) ?? [])) {
        const { data: rows, error } = await supabase
          .from(spec.table)
          .select("id")
          .in(column, keys);
        if (error) {
          throw new Error(`Could not find ${spec.table}: ${error.message}`);
        }
        for (const row of rows) found.add(String(row.id));
      }
    }
    ids.set(spec.table, [...found]);
  }
  return ids;
}

/**
 * Deletes the rows an earlier run made, and anything the team added in the app under
 * them, children before parents.
 */
export async function removeExampleRows(
  supabase: SupabaseClient,
  data: ExampleData,
): Promise<void> {
  const ids = await idsToClear(supabase, data);
  for (const spec of [...data.tables].reverse()) {
    if (spec.clearedByParent) continue;
    for (const [column, parent] of parentsOf(spec.table)) {
      await deleteWhere(supabase, spec.table, column, ids.get(parent) ?? []);
    }
    await deleteWhere(supabase, spec.table, spec.key, keysToDelete(spec));
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
