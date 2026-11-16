import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 21 task 07: PostgREST's upsert also sets the key column when the row exists, so an
// update grant on `value` alone made every settings save fail for the MD.

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const upsert = (key: string, value: string) =>
  t.db.query(
    "insert into public.app_settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set key = excluded.key, value = excluded.value",
    [key, value],
  );

it("the MD saves a setting that already exists", async () => {
  await t.actAs("md");
  await expect(upsert("stock_hold_days", "21")).resolves.toBeDefined();
});

it("HR & Accounts saves the claim settings", async () => {
  await t.actAs("accounts");
  await expect(
    upsert(
      "claims",
      '{"cutOffDay": 20, "mileageRatePerKm": 0.6, "kmPerDay": 150, "monthlyTravelLimit": 0, "needReport": true}',
    ),
  ).resolves.toBeDefined();
});

it("HR & Accounts still cannot save another setting", async () => {
  await t.actAs("accounts");
  await expect(upsert("stock_hold_days", "30")).rejects.toThrow();
});
