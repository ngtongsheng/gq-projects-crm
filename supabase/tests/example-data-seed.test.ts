import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExampleData } from "../../scripts/example-data/dataset";
import {
  insertExampleRows,
  removeExampleRows,
} from "../../scripts/example-data/example-rows";
import { exampleId } from "../../scripts/example-data/ids";
import { TEST_USERS } from "../../scripts/example-data/people";
import type { People } from "../../scripts/example-data/types";
import { todayMyt } from "../../src/lib/format/date";
import { createTestDatabase, type TestDatabase } from "./harness";

// The example dataset is inserted into a database with every migration, as the seed script
// does against the test copy, so a rule the rows break (a payout past the cap, a date in the
// future) fails here and not only when the seed is run.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

type Rows = { data: Record<string, unknown>[] | null; error: Error | null };

/** The slice of the Supabase client the seed script uses, run as SQL on the test database. */
function sqlClient(db: PGlite): SupabaseClient {
  const run = async (sql: string, params: unknown[]): Promise<Rows> => {
    try {
      const { rows } = await db.query<Record<string, unknown>>(sql, params);
      return { data: rows, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  };
  const from = (table: string) => ({
    select: (columns: string) => ({
      in: (column: string, keys: string[]) =>
        run(
          `select ${columns} from public.${table} where ${column}::text = any($1)`,
          [keys],
        ),
    }),
    delete: () => ({
      in: (column: string, keys: string[]) =>
        run(`delete from public.${table} where ${column}::text = any($1)`, [
          keys,
        ]),
    }),
    insert: async (rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        const columns = Object.keys(row)
          .map((name) => `"${name}"`)
          .join(", ");
        const { error } = await run(
          `insert into public.${table} (${columns})
           select ${columns} from jsonb_populate_record(null::public.${table}, $1::jsonb)`,
          [JSON.stringify(row)],
        );
        if (error) return { error };
      }
      return { error: null };
    },
    update: (values: Record<string, unknown>) => ({
      in: (column: string, keys: string[]) =>
        run(
          `update public.${table} set status = $2 where ${column}::text = any($1)`,
          [keys, values.status],
        ),
    }),
  });
  return { from } as unknown as SupabaseClient;
}

let peopleAdded: People | undefined;

async function addPeople(): Promise<People> {
  if (peopleAdded) return peopleAdded;
  await t.actAs(null);
  const people: Record<string, string> = {};
  for (const user of TEST_USERS) {
    const { rows } = await t.db.query<{ id: string }>(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) returning id",
      [
        exampleId("profiles", user.key),
        `${user.key}@example.test`,
        { full_name: user.fullName },
      ],
    );
    people[user.key] = rows[0].id;
    await t.db.query(
      `update public.profiles set full_name = $2, role = $3, job_role = $4, title = $5,
         arranges_stock = $6, sells = $7, sees_margin = $8, language = $9, yearly_target = $10,
         active = $11, left_on = $12, left_reason = $13
       where id = $1`,
      [
        rows[0].id,
        user.fullName,
        user.role,
        user.jobRole,
        user.title,
        user.arrangesStock,
        user.sells,
        user.seesMargin,
        user.language,
        user.yearlyTarget,
        user.left === null,
        user.left?.on ?? null,
        user.left?.reason ?? null,
      ],
    );
  }
  for (const user of TEST_USERS) {
    if (!user.reportsTo) continue;
    await t.db.query(
      "update public.profiles set reports_to = $2 where id = $1",
      [people[user.key], people[user.reportsTo]],
    );
  }
  peopleAdded = people as People;
  return peopleAdded;
}

describe("example dataset", () => {
  it("is accepted by the database, payouts included", async () => {
    const people = await addPeople();
    const data = buildExampleData({ people, today: todayMyt() });

    for (const spec of data.tables) {
      for (const row of spec.rows) {
        // Only the row's own columns, so the table's defaults fill the rest as the API does.
        const columns = Object.keys(row).map((name) => `"${name}"`);
        await t.db.query(
          `insert into public.${spec.table} (${columns.join(", ")})
           select ${columns.join(", ")}
           from jsonb_populate_record(null::public.${spec.table}, $1::jsonb)`,
          [JSON.stringify(row)],
        );
      }
    }

    const { rows } = await t.db.query<{ count: number }>(
      "select count(*)::int as count from public.commission_payouts",
    );
    expect(rows[0].count).toBeGreaterThan(0);
  });

  it("seeds twice to the same rows, and the reset clears quotes the team changed", async () => {
    const people = await addPeople();
    const data = buildExampleData({ people, today: todayMyt() });
    const client = sqlClient(t.db);
    const count = async (table: string) =>
      (
        await t.db.query<{ n: number }>(
          `select count(*)::int as n from public.${table}`,
        )
      ).rows[0].n;
    const quoteTables = [
      "quotes",
      "quote_revisions",
      "quote_options",
      "quote_items",
      "quote_revision_history",
      "fob_enquiries",
    ];

    await removeExampleRows(client, data);
    await insertExampleRows(client, data);
    const first = await Promise.all(quoteTables.map(count));

    // The team picks an option on an approved example quote, then adds a quote of its own on
    // an example project: the reset must still clear both so the project can be deleted.
    const approved = exampleId("quote_revisions", "meridian-showroom");
    await t.db.query(
      "update public.quote_revisions set chosen_option_id = $2 where id = $1",
      [approved, exampleId("quote_options", "meridian-showroom:A")],
    );
    await t.db.query(
      `insert into public.quotes (quote_no, project_id, project_name, customer_name, salesperson_id)
       values ('GQ9999', $1, 'Added', 'Added', $2)`,
      [exampleId("projects", "meridian-showroom"), people.vernice],
    );

    await removeExampleRows(client, data);
    await insertExampleRows(client, data);

    expect(await Promise.all(quoteTables.map(count))).toEqual(first);
    expect(first.every((n) => n > 0)).toBe(true);
  });
});
