import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// The MD, Purchasing and HR & Accounts see an MOF's cost, and the payments next to it in the
// MOF summary. The Sales Director and salespeople do not see cost.

let t: TestDatabase;
let mofId: string;

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
  await t.actAs(null);
  await t.db.query(
    "insert into public.mof_costs (mof_id, cost) values ($1, 640)",
    [mofId],
  );
  await t.db.query(
    "insert into public.payments (mof_id, amount, received_on) values ($1, 250, '2026-11-01')",
    [mofId],
  );
});

afterAll(async () => {
  await t.close();
});

async function visible(jobRole: JobRole, table: "mof_costs" | "payments") {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ n: number }>(
    `select count(*) as n from public.${table} where mof_id = $1`,
    [mofId],
  );
  return Number(rows[0].n);
}

describe("who reads an MOF's cost", () => {
  it.each([
    "md",
    "support",
    "accounts",
  ] as const)("%s reads it", async (role) => {
    expect(await visible(role, "mof_costs")).toBe(1);
  });

  it.each([
    "director",
    "bd",
    "sales",
    "site",
  ] as const)("%s does not", async (role) => {
    expect(await visible(role, "mof_costs")).toBe(0);
  });
});

describe("who sets an MOF's cost", () => {
  it("lets Purchasing change it", async () => {
    await t.actAs("support");
    await t.db.query(
      "update public.mof_costs set cost = 700 where mof_id = $1",
      [mofId],
    );
    await t.actAs(null);
    const { rows } = await t.db.query<{ cost: string }>(
      "select cost from public.mof_costs where mof_id = $1",
      [mofId],
    );
    expect(rows[0].cost).toBe("700.00");
  });

  it("does not let the Sales Director change it", async () => {
    await t.actAs("director");
    const result = await t.db.query(
      "update public.mof_costs set cost = 1 where mof_id = $1 returning cost",
      [mofId],
    );
    expect(result.rows).toEqual([]);
  });
});

describe("who reads payments", () => {
  it("lets Purchasing read them for the MOF summary", async () => {
    expect(await visible("support", "payments")).toBe(1);
  });

  it("still hides them from a salesperson who is not on the MOF", async () => {
    expect(await visible("site", "payments")).toBe(0);
  });
});
