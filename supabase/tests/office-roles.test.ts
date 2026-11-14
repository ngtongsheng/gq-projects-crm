import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof, addProject } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 task 03: the three new job roles read what their demo pages show, a person who has
// left reads nothing, and only a Sales Director or Marketing Director can lead a team.

let t: TestDatabase;

const TABLES = [
  "companies",
  "projects",
  "jobs",
  "site_logs",
  "stock_items",
  "installer_pos",
  "payments",
] as const;
type Table = (typeof TABLES)[number];

async function count(jobRole: JobRole, table: Table) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ n: number }>(
    `select count(*)::int as n from public.${table}`,
  );
  return rows[0].n;
}

async function reads(jobRole: JobRole) {
  const entries = [];
  for (const table of TABLES) {
    entries.push([table, (await count(jobRole, table)) > 0] as const);
  }
  return Object.fromEntries(entries);
}

async function asServiceRole(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  await t.db.query(sql, params);
}

beforeAll(async () => {
  t = await createTestDatabase();
  await addProject(t);
  const mofId = await addMof(t);
  await asServiceRole(
    `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on)
     values ($1, 'delivery', current_date, current_date)`,
    [mofId],
  );
  await asServiceRole(
    `insert into public.site_logs (mof_id, visited_on, supervisor_id, activity)
     values ($1, current_date, $2, 'inspection')`,
    [mofId, t.profileIds.site],
  );
  await asServiceRole(
    "insert into public.stock_items (sku, supplier, qty, unit) values ('SKU-1', 'Supplier', 5, 'box')",
  );
  await asServiceRole(
    `insert into public.installer_pos (mof_id, po_no, po_date, installer, amount)
     values ($1, 'IPO-1', current_date, 'Installer', 100)`,
    [mofId],
  );
  await asServiceRole(
    `insert into public.payments (mof_id, received_on, amount)
     values ($1, current_date, 100)`,
    [mofId],
  );
});

afterAll(async () => {
  await t.close();
});

describe("what the new job roles read", () => {
  it("sales support reads jobs, site work, stock and projects like Purchasing", async () => {
    expect(await reads("ssup")).toEqual({
      companies: true,
      projects: true,
      jobs: true,
      site_logs: true,
      stock_items: true,
      installer_pos: false,
      payments: false,
    });
  });

  it("marketing reads site logs and stock, not projects or money", async () => {
    expect(await reads("marketing")).toEqual({
      companies: true,
      projects: false,
      jobs: true,
      site_logs: true,
      stock_items: true,
      installer_pos: false,
      payments: false,
    });
  });

  it("a designer gets only the shared reads", async () => {
    const designer = await reads("designer");
    expect(designer.projects).toBe(false);
    expect(designer.installer_pos).toBe(false);
    expect(designer.payments).toBe(false);
  });

  it.each([
    "ssup",
    "marketing",
    "designer",
  ] as const)("%s cannot add a company", async (jobRole) => {
    await t.actAs(jobRole);
    await expect(
      t.db.query("insert into public.companies (name) values ($1)", [
        `By ${jobRole}`,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("a person who has left", () => {
  beforeAll(async () => {
    await asServiceRole(
      "update public.profiles set active = false, left_on = current_date where id = $1",
      [t.profileIds.md],
    );
  });

  afterAll(async () => {
    await asServiceRole(
      "update public.profiles set active = true, left_on = null where id = $1",
      [t.profileIds.md],
    );
  });

  it("reads nothing, even as the MD and admin", async () => {
    for (const table of TABLES) {
      expect(await count("md", table)).toBe(0);
    }
  });

  it("still reads their own profile, so the app can sign them out", async () => {
    await t.actAs("md");
    const { rows } = await t.db.query<{ id: string; active: boolean }>(
      "select id, active from public.profiles",
    );
    expect(rows).toEqual([{ id: t.profileIds.md, active: false }]);
  });

  it("has no role and cannot write", async () => {
    await t.actAs("md");
    const { rows } = await t.db.query<{ admin: boolean; role: string | null }>(
      "select public.is_admin() as admin, public.job_role() as role",
    );
    expect(rows[0]).toEqual({ admin: false, role: null });
    await expect(
      t.db.query("insert into public.companies (name) values ('Left Co')"),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("who a person reports to", () => {
  const setReportsTo = async (lead: JobRole) => {
    await t.actAs("md");
    return t.db.query(
      "update public.profiles set reports_to = $1 where id = $2",
      [t.profileIds[lead], t.profileIds.sales],
    );
  };

  it.each([
    "director",
    "bd",
  ] as const)("a salesperson can report to %s", async (lead) => {
    await setReportsTo(lead);
    await t.actAs(null);
    const { rows } = await t.db.query<{ reports_to: string }>(
      "select reports_to from public.profiles where id = $1",
      [t.profileIds.sales],
    );
    expect(rows[0].reports_to).toBe(t.profileIds[lead]);
  });

  it.each([
    "md",
    "support",
    "sales",
  ] as const)("refuses %s as a team lead", async (lead) => {
    await expect(setReportsTo(lead)).rejects.toThrow(
      /Sales Director or Marketing Director|reports_to_not_self/,
    );
  });

  it("refuses a WhatsApp number that is not digits and an unknown language", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(
        "update public.profiles set whatsapp = '+60 12' where id = $1",
        [t.profileIds.sales],
      ),
    ).rejects.toThrow(/whatsapp_check/);
    await expect(
      t.db.query("update public.profiles set language = 'fr' where id = $1", [
        t.profileIds.sales,
      ]),
    ).rejects.toThrow(/language_check/);
  });
});
