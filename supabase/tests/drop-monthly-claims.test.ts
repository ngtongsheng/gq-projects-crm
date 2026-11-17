import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 25 task 05 (D1, D7): the monthly claim is gone; only the cut-off day of its settings stays.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const upsertClaims = (value: string) =>
  t.db.query(
    "insert into public.app_settings (key, value) values ('claims', $1::jsonb) on conflict (key) do update set key = excluded.key, value = excluded.value",
    [value],
  );

describe("dropping the monthly claim", () => {
  // The underscore is escaped: a bare _ in like matches any character.
  it("leaves no monthly claim table or function", async () => {
    const { rows } = await t.db.query<{ name: string }>(
      `select relname as name from pg_class
       where relnamespace = 'public'::regnamespace and relname like 'monthly\\_claim%'
       union all
       select proname from pg_proc
       where pronamespace = 'public'::regnamespace and proname like '%monthly\\_claim%'`,
    );
    expect(rows).toEqual([]);
  });

  it("keeps the cut-off day and drops the other claim settings", async () => {
    const { rows } = await t.db.query<{ value: unknown }>(
      "select value from public.app_settings where key = 'claims'",
    );
    expect(rows[0].value).toEqual({ cutOffDay: 25 });
  });

  it("no longer lets HR & Accounts change the claim settings", async () => {
    await t.actAs("accounts");
    await expect(upsertClaims('{"cutOffDay": 20}')).rejects.toThrow();
  });

  it("still lets the MD set the cut-off day", async () => {
    await t.actAs("md");
    await expect(upsertClaims('{"cutOffDay": 20}')).resolves.toBeDefined();
  });
});
