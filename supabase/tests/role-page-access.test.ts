import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 task 06: everyone signed in reads the access matrix, only the MD changes it, and
// the "See margin % and cost" row and a person's own tick decide can_see_mof_cost().

let t: TestDatabase;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.actAs(null);
  await t.db.exec(
    "truncate public.role_page_access; update public.profiles set sees_margin = false, arranges_stock = false",
  );
});

async function seesCost(jobRole: JobRole) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ ok: boolean }>(
    "select public.can_see_mof_cost() as ok",
  );
  return rows[0].ok;
}

async function setMargin(roleKey: string, allowed: boolean) {
  await t.actAs("md");
  await t.db.query(
    "insert into public.role_page_access (role_key, page_key, allowed) values ($1, 'margin', $2)",
    [roleKey, allowed],
  );
}

describe("who changes the matrix", () => {
  it("lets the MD add, change and remove an override", async () => {
    await t.actAs("md");
    await t.db.query(
      "insert into public.role_page_access (role_key, page_key, allowed) values ('sales', 'coll', false)",
    );
    await t.db.query(
      "update public.role_page_access set allowed = true where role_key = 'sales'",
    );
    const { rows } = await t.db.query<{ n: number }>(
      "with gone as (delete from public.role_page_access returning 1) select count(*)::int as n from gone",
    );
    expect(rows[0].n).toBe(1);
  });

  it.each([
    "accounts",
    "director",
    "sales",
  ] as const)("refuses %s", async (jobRole) => {
    await t.actAs(jobRole);
    await expect(
      t.db.query(
        "insert into public.role_page_access (role_key, page_key, allowed) values ('sales', 'coll', false)",
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets everyone signed in read it", async () => {
    await setMargin("sales", true);
    await t.actAs("designer");
    const { rows } = await t.db.query("select * from public.role_page_access");
    expect(rows).toHaveLength(1);
  });

  it("refuses an unknown page or the MD's own column", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        "insert into public.role_page_access (role_key, page_key, allowed) values ('sales', 'people', true)",
      ),
    ).rejects.toThrow(/check/);
    await expect(
      t.db.query(
        "insert into public.role_page_access (role_key, page_key, allowed) values ('md', 'coll', false)",
      ),
    ).rejects.toThrow(/check/);
  });
});

describe("can_see_mof_cost()", () => {
  it("defaults to the MD, HR & Accounts and Purchasing", async () => {
    expect(await seesCost("md")).toBe(true);
    expect(await seesCost("accounts")).toBe(true);
    expect(await seesCost("support")).toBe(true);
    expect(await seesCost("director")).toBe(false);
    expect(await seesCost("sales")).toBe(false);
  });

  it("follows the margin row for the role", async () => {
    await setMargin("director", true);
    await setMargin("support", false);
    expect(await seesCost("director")).toBe(true);
    expect(await seesCost("support")).toBe(false);
  });

  it("reads a salesperson who arranges stock from their own column", async () => {
    await setMargin("arrange", true);
    expect(await seesCost("sales")).toBe(false);
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set arranges_stock = true where id = $1",
      [t.profileIds.sales],
    );
    expect(await seesCost("sales")).toBe(true);
  });

  it("is given to one person by their own tick", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set sees_margin = true where id = $1",
      [t.profileIds.sales],
    );
    expect(await seesCost("sales")).toBe(true);
    expect(await seesCost("director")).toBe(false);
  });
});

describe("a person who has left", () => {
  it("reads nothing", async () => {
    await setMargin("sales", true);
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.designer],
    );
    await t.actAs("designer");
    const { rows } = await t.db.query("select * from public.role_page_access");
    expect(rows).toHaveLength(0);
    await t.actAs(null);
    await t.db.query("update public.profiles set active = true where id = $1", [
      t.profileIds.designer,
    ]);
  });
});
