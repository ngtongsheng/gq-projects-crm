import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = join(import.meta.dirname, "..", "supabase", "migrations");

// Replaced by 20261119120000_numbering_where_clause.sql; the old files stay as merged.
const FIXED_LATER = new Set([
  "20261118120000_do_numbering.sql",
  "20261118150000_samples.sql",
]);

/** Statements that update a table with no WHERE clause, e.g. `update public.t set a = 1;`. */
function unscopedUpdates(sql: string): string[] {
  const withoutComments = sql.replace(/--.*$/gm, "");
  return withoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        /^update\s+public\.\w+\s+set\b/i.test(statement) &&
        !/\bwhere\b/i.test(statement),
    );
}

describe("migrations", () => {
  // Supabase runs pg-safeupdate, which refuses an UPDATE without WHERE ("UPDATE requires a WHERE
  // clause"). PGlite has no such extension, so the database tests cannot catch it.
  it("never update a table without a WHERE clause", () => {
    const offenders = readdirSync(MIGRATIONS)
      .filter((file) => file.endsWith(".sql") && !FIXED_LATER.has(file))
      .flatMap((file) =>
        unscopedUpdates(readFileSync(join(MIGRATIONS, file), "utf8")).map(
          (statement) => `${file}: ${statement}`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("finds an update with no WHERE clause", () => {
    expect(unscopedUpdates("update public.t set a = 1;")).toHaveLength(1);
    expect(unscopedUpdates("update public.t set a = 1 where id;")).toHaveLength(
      0,
    );
  });
});
