import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 task 08 (D6, D7): defaults use the Malaysian day, and a receipt number is allocated
// under the claim row's lock.

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

describe("receipt numbering", () => {
  let claimId: string;

  async function attachReceipt(n: number) {
    const { rows } = await t.db.query<{ receipt_no: number }>(
      `insert into public.monthly_claim_expenses
         (claim_id, spent_on, description, expense_type, amount,
          receipt_path, receipt_file_name, receipt_content_type)
       values ($1, $2, 'Toll', 'toll', 5, $3, $4, 'image/jpeg') returning receipt_no`,
      [
        claimId,
        await malaysiaDate(t),
        `claims/${claimId}/r${n}.jpg`,
        `r${n}.jpg`,
      ],
    );
    return rows[0].receipt_no;
  }

  beforeAll(async () => {
    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string }>(
      "insert into public.monthly_claims (month) values ('2027-03-01') returning id",
    );
    claimId = rows[0].id;
  });

  it("gives each receipt on a claim its own number", async () => {
    expect(await attachReceipt(1)).toBe(1);
    expect(await attachReceipt(2)).toBe(2);
    expect(await attachReceipt(3)).toBe(3);
  });

  // PGlite has one connection, so two writers cannot race here; and the claim row is already
  // share-locked by the foreign key, so a held lock cannot tell the modes apart. The lock is
  // therefore checked in the function itself.
  it("takes the claim row lock before reading the highest number", async () => {
    const { rows } = await t.db.query<{ src: string; definer: boolean }>(
      `select prosrc as src, prosecdef as definer from pg_proc
       where proname = 'prepare_monthly_claim_expense'`,
    );
    const lockAt = rows[0].src.search(
      /from public\.monthly_claims where id = new\.claim_id for update/,
    );
    expect(lockAt).toBeGreaterThan(-1);
    expect(lockAt).toBeLessThan(rows[0].src.indexOf("max(receipt_no)"));
    expect(rows[0].definer).toBe(true);
  });
});
