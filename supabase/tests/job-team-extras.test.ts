import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMof } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 18 task 03: a job can be supervisor only, and a salesperson can be in charge.

let t: TestDatabase;
let mofId: string;

async function addJob(fields: {
  supervisorOnly?: boolean;
  installer?: string;
}) {
  await t.actAs("support");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.jobs (mof_id, job_type, scheduled_on, ends_on, supervisor_only, installer,
       site_supervisor_id)
     values ($1, 'installation', '2026-11-20', '2026-11-20', $2, $3, $4) returning id`,
    [
      mofId,
      fields.supervisorOnly ?? false,
      fields.installer ?? null,
      t.profileIds.site,
    ],
  );
  return rows[0].id;
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
});

afterAll(async () => {
  await t.close();
});

describe("a supervisor-only job", () => {
  it("is saved for a scheduler", async () => {
    const id = await addJob({ supervisorOnly: true });
    const { rows } = await t.db.query<{ supervisor_only: boolean }>(
      "select supervisor_only from public.jobs where id = $1",
      [id],
    );
    expect(rows[0].supervisor_only).toBe(true);
  });

  it("cannot also name an installer", async () => {
    await expect(
      addJob({ supervisorOnly: true, installer: "Leong" }),
    ).rejects.toThrow(/jobs_supervisor_only_has_no_installer/);
  });

  it("can be given an installer later", async () => {
    const id = await addJob({ supervisorOnly: true });
    await t.db.query(
      "update public.jobs set supervisor_only = false, installer = 'Leong' where id = $1",
      [id],
    );
    const { rows } = await t.db.query<{ installer_id: string | null }>(
      "select installer_id from public.jobs where id = $1",
      [id],
    );
    expect(rows[0].installer_id).not.toBeNull();
  });

  it("cannot be changed by its Site Supervisor, who only moves the status", async () => {
    const id = await addJob({ supervisorOnly: true });
    await t.actAs("site");
    await expect(
      t.db.query(
        "update public.jobs set supervisor_only = false where id = $1",
        [id],
      ),
    ).rejects.toThrow(/only change the status/);
    await t.db.query(
      "update public.jobs set status = 'in_progress' where id = $1",
      [id],
    );
  });
});

describe("salespeople()", () => {
  it("lists directors, marketing directors and salespeople to staff, not site supervisors", async () => {
    await t.actAs("site");
    const { rows } = await t.db.query<{ id: string }>(
      "select id from public.salespeople()",
    );
    expect(rows.map((row) => row.id).sort()).toEqual(
      [t.profileIds.director, t.profileIds.bd, t.profileIds.sales].sort(),
    );
  });

  it("leaves out someone who has left", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.sales],
    );
    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string }>(
      "select id from public.salespeople()",
    );
    expect(rows.map((row) => row.id)).not.toContain(t.profileIds.sales);
  });
});
