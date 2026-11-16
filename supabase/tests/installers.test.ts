import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 18 task 01 (D1): installers become a directory; every job points at its installer and
// keeps the installer text it had.

const MIGRATION = "20261118100000_installers.sql";

let t: TestDatabase;
let mofId: string;

async function addJob(installer: string | null, installerId?: string) {
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on, installer, installer_id)
     values ($1, 'installation', '2026-11-20', '2026-11-20', $2, $3) returning id`,
    [mofId, installer, installerId ?? null],
  );
  return rows[0].id;
}

async function job(id: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{
    installer: string | null;
    installer_id: string | null;
  }>("select installer, installer_id from public.jobs where id = $1", [id]);
  return rows[0];
}

async function installerNamed(name: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string; name: string }>(
    "select id, name from public.installers where name = $1",
    [name],
  );
  return rows[0];
}

async function addInstaller(jobRole: JobRole, name: string) {
  await t.actAs(jobRole);
  await t.db.query("insert into public.installers (name) values ($1)", [name]);
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
});

afterAll(async () => {
  await t.close();
});

describe("the backfill", () => {
  let before: TestDatabase;
  let jobsBefore: Record<string, unknown>[];
  const readJobs = () =>
    before.db.query<Record<string, unknown>>(
      `select id, mof_id, job_type, status, scheduled_on, ends_on, start_time, installer,
         site_supervisor_id, notes, created_at, created_by from public.jobs order by id`,
    );

  beforeAll(async () => {
    before = await createTestDatabase({ migrationsBefore: MIGRATION });
    await before.actAs(null);
    const {
      rows: [mof],
    } = await before.db.query<{ id: string }>(
      `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name,
         contract_sum, installer_name)
       values ('MOF-OLD', current_date, $1, 'Old Co', 'Old Project', 1000, ' Yew ') returning id`,
      [before.profileIds.sales],
    );
    await before.db.query(
      `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name,
         contract_sum, installer_name)
       values ('MOF-NA', current_date, $1, 'Old Co', 'Other Project', 1000, 'N/A')`,
      [before.profileIds.sales],
    );
    for (const installer of [
      "Leong",
      "leong",
      "Leong",
      "Kelvin  Tan",
      "kelvin tan",
      "Adi",
      null,
    ]) {
      await before.db.query(
        `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on, installer)
         values ($1, 'installation', '2026-11-01', '2026-11-01', $2)`,
        [mof.id, installer],
      );
    }
    await before.db.query(
      `insert into public.installer_pos (mof_id, po_no, po_date, installer, amount)
       values ($1, 'PO-1', current_date, 'Ivan', 500)`,
      [mof.id],
    );
    jobsBefore = (await readJobs()).rows;

    await applyMigrations(before.db, { from: MIGRATION });
  });

  afterAll(async () => {
    await before.close();
  });

  it("keeps every job's installer text", async () => {
    expect((await readJobs()).rows).toEqual(jobsBefore);
  });

  it("links every job that names an installer", async () => {
    const { rows } = await before.db.query<{
      installer: string | null;
      installer_id: string | null;
    }>("select installer, installer_id from public.jobs");
    for (const row of rows) {
      expect(row.installer_id === null).toBe(row.installer === null);
    }
  });

  it("makes one installer of names that differ only in case or spaces", async () => {
    const { rows } = await before.db.query<{ installer: string; name: string }>(
      `select j.installer, i.name from public.jobs j
       join public.installers i on i.id = j.installer_id`,
    );
    const nameOf = Object.fromEntries(rows.map((r) => [r.installer, r.name]));
    expect(nameOf).toEqual({
      Leong: "Leong",
      leong: "Leong",
      "Kelvin  Tan": "Kelvin Tan",
      "kelvin tan": "Kelvin Tan",
      Adi: "Adi",
    });
  });

  it("adds installers named only on POs and MOFs, but not N/A", async () => {
    const { rows } = await before.db.query<{ name: string }>(
      "select name from public.installers order by name",
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Adi",
      "Ivan",
      "Kelvin Tan",
      "Leong",
      "Yew",
    ]);
  });
});

describe("a job", () => {
  it("typed with a known name links that installer", async () => {
    await addInstaller("support", "Frankie");
    const frankie = await installerNamed("Frankie");
    await t.actAs("support");
    const id = await addJob("FRANKIE");
    expect(await job(id)).toEqual({
      installer: "FRANKIE",
      installer_id: frankie.id,
    });
  });

  it("typed with a new name adds the installer", async () => {
    await t.actAs("director");
    const id = await addJob("Rajib");
    const rajib = await installerNamed("Rajib");
    expect((await job(id)).installer_id).toBe(rajib.id);
  });

  it("given an installer takes their name", async () => {
    await addInstaller("md", "Onn");
    const onn = await installerNamed("Onn");
    await t.actAs("support");
    const id = await addJob(null, onn.id);
    expect(await job(id)).toEqual({ installer: "Onn", installer_id: onn.id });
  });

  it("cleared of its installer text loses the link", async () => {
    await t.actAs("support");
    const id = await addJob("Rajib");
    await t.db.query("update public.jobs set installer = null where id = $1", [
      id,
    ]);
    expect(await job(id)).toEqual({ installer: null, installer_id: null });
  });

  it("cannot have its installer changed by its Site Supervisor", async () => {
    await t.actAs(null);
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on, site_supervisor_id)
       values ($1, 'installation', '2026-11-20', '2026-11-20', $2) returning id`,
      [mofId, t.profileIds.site],
    );
    const onn = await installerNamed("Onn");
    await t.actAs("site");
    await expect(
      t.db.query("update public.jobs set installer_id = $1 where id = $2", [
        onn.id,
        rows[0].id,
      ]),
    ).rejects.toThrow(/only change the status/);
  });
});

describe("the installer directory", () => {
  it("is read by everyone signed in", async () => {
    await t.actAs("sales");
    const { rows } = await t.db.query("select id from public.installers");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("is kept by Site Supervisors but not by HR & Accounts or sales", async () => {
    await addInstaller("site", "Alvin");
    expect(await installerNamed("Alvin")).toBeDefined();
    await expect(addInstaller("accounts", "Ivan")).rejects.toThrow(
      /row-level security/,
    );
    await expect(addInstaller("sales", "Ivan")).rejects.toThrow(
      /row-level security/,
    );
  });

  it("is kept by a salesperson who arranges stock", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set arranges_stock = true where id = $1",
      [t.profileIds.sales],
    );
    try {
      await addInstaller("sales", "Kelvin");
      expect(await installerNamed("Kelvin")).toBeDefined();
    } finally {
      await t.actAs(null);
      await t.db.query(
        "update public.profiles set arranges_stock = false where id = $1",
        [t.profileIds.sales],
      );
    }
  });

  it("refuses a second installer whose name differs only in case or spaces", async () => {
    await addInstaller("md", "Chua  KV");
    await expect(addInstaller("md", "chua kv")).rejects.toThrow(
      /installers_name_key_unique/,
    );
  });
});
