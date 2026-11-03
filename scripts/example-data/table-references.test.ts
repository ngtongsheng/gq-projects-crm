import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXAMPLE_REFERENCES } from "./table-references.ts";

const MIGRATIONS = join(import.meta.dirname, "../../supabase/migrations");

/** table -> column -> referenced table, read from `create table` blocks; profiles left out. */
function referencesInMigrations(): Record<string, Record<string, string>> {
  const found: Record<string, Record<string, string>> = {};
  for (const file of readdirSync(MIGRATIONS).sort()) {
    let table = "";
    for (const line of readFileSync(join(MIGRATIONS, file), "utf8").split(
      "\n",
    )) {
      const created = line.match(/create table public\.([a-z_]+)/);
      if (created) table = created[1];
      const ref = line.match(/^\s*([a-z_]+)\s.*references public\.([a-z_]+)/);
      if (table && ref && ref[2] !== "profiles") {
        found[table] = { ...found[table], [ref[1]]: ref[2] };
      }
    }
  }
  return found;
}

describe("EXAMPLE_REFERENCES", () => {
  it("matches the foreign keys in the migrations", () => {
    expect(EXAMPLE_REFERENCES).toEqual(referencesInMigrations());
  });
});
