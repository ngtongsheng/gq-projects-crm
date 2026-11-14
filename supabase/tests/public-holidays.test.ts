import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 task 13: everyone signed in reads the holiday list; only the MD and HR & Accounts
// change it; a person who has left sees nothing.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.actAs(null);
  await t.db.exec("delete from public.public_holidays");
  await t.db.exec(
    "insert into public.public_holidays (day, name) values ('2026-12-25', 'Christmas Day')",
  );
  await t.db.query("update public.profiles set active = true, left_on = null");
});

describe("seed", () => {
  it("ships the demo's Christmas Day", async () => {
    // beforeEach reset the table, so read the migration's own rows from a fresh database.
    const fresh = await createTestDatabase();
    const { rows } = await fresh.db.query<{ day: string; name: string }>(
      "select day::text as day, name from public.public_holidays order by day",
    );
    await fresh.close();
    expect(rows).toEqual([
      { day: "2026-12-25", name: "Christmas Day" },
      { day: "2027-12-25", name: "Christmas Day" },
    ]);
  });
});

describe("who reads", () => {
  it.each([
    "md",
    "sales",
    "site",
  ] as const)("lets %s read the list", async (jobRole) => {
    await t.actAs(jobRole);
    const { rows } = await t.db.query("select * from public.public_holidays");
    expect(rows).toHaveLength(1);
  });

  it("shows a person who has left nothing", async () => {
    await t.db.query(
      "update public.profiles set active = false, left_on = current_date where id = $1",
      [t.profileIds.sales],
    );
    await t.actAs("sales");
    const { rows } = await t.db.query("select * from public.public_holidays");
    expect(rows).toHaveLength(0);
  });
});

describe("who changes", () => {
  it.each([
    "md",
    "accounts",
  ] as const)("lets %s add, rename and remove a holiday", async (jobRole) => {
    await t.actAs(jobRole);
    await t.db.query(
      "insert into public.public_holidays (day, name) values ('2027-01-01', 'New Year')",
    );
    await t.db.query(
      "update public.public_holidays set name = 'New Year''s Day' where day = '2027-01-01'",
    );
    const { rows } = await t.db.query<{ n: number }>(
      "with gone as (delete from public.public_holidays where day = '2027-01-01' returning 1) select count(*)::int as n from gone",
    );
    expect(rows[0].n).toBe(1);
  });

  it.each([
    "director",
    "sales",
    "site",
  ] as const)("refuses %s", async (jobRole) => {
    await t.actAs(jobRole);
    await expect(
      t.db.query(
        "insert into public.public_holidays (day, name) values ('2027-01-01', 'New Year')",
      ),
    ).rejects.toThrow(/row-level security/);
    const update = await t.db.query(
      "update public.public_holidays set name = 'x' returning 1",
    );
    expect(update.rows).toHaveLength(0);
    const remove = await t.db.query(
      "delete from public.public_holidays returning 1",
    );
    expect(remove.rows).toHaveLength(0);
  });

  it("refuses an empty name", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        "insert into public.public_holidays (day, name) values ('2027-01-01', '  ')",
      ),
    ).rejects.toThrow(/check/);
  });
});
