import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 task 08 (D6): defaults use the Malaysian day. The receipt numbering it also fixed went
// with the monthly claim (loop 25).

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

/** Runs a column's default expression as if the clock read `instant`. */
async function defaultDayAt(table: string, column: string, instant: string) {
  const { rows } = await t.db.query<{ expr: string }>(
    `select pg_get_expr(d.adbin, d.adrelid) as expr
     from pg_attrdef d
     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
     where d.adrelid = $1::regclass and a.attname = $2`,
    [`public.${table}`, column],
  );
  // The old default was current_date; pin it to the same instant, read in the session's UTC.
  const asOfInstant = rows[0].expr
    .replace(/\bnow\(\)/g, `'${instant}'::timestamptz`)
    .replace(/\bcurrent_date\b/gi, `('${instant}'::timestamptz)::date`);
  const { rows: day } = await t.db.query<{ d: string }>(
    `select to_char((${asOfInstant}), 'YYYY-MM-DD') as d`,
  );
  return day[0].d;
}

describe("dates default to the Malaysian day", () => {
  // 00:30 on the 16th in Kuala Lumpur is 16:30 on the 15th in UTC.
  it.each([
    ["tasks", "assigned_on"],
    ["fob_enquiries", "enquiry_date"],
  ])("%s.%s at 00:30 Malaysian time is that day, not the UTC day", async (table, column) => {
    expect(await defaultDayAt(table, column, "2026-11-15T16:30:00Z")).toBe(
      "2026-11-16",
    );
  });
});
