import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildExampleData } from "../../scripts/example-data/dataset";
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

async function addPeople(): Promise<People> {
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
  return people as People;
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
});
