import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addMof, addProject, malaysiaDate } from "./fixtures";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 17 task 01 (D2, D5): site logs gain the wizard's fields and may have no MOF yet; the
// site team writes its own logs and off days; marketing reads only shooting requests and logs.

const MIGRATION = "20261117100000_site_log_parity.sql";

let t: TestDatabase;
let mofId: string;

async function as<T>(jobRole: JobRole | null, run: () => Promise<T>) {
  await t.actAs(jobRole);
  return run();
}

async function addLog(columns: Record<string, unknown>) {
  const names = Object.keys(columns);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.site_logs (${names.join(", ")})
     values (${names.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(columns),
  );
  return rows[0].id;
}

async function siteLog(id: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<Record<string, unknown>>(
    "select * from public.site_logs where id = $1",
    [id],
  );
  return rows[0];
}

beforeAll(async () => {
  t = await createTestDatabase();
  mofId = await addMof(t);
});

afterAll(async () => {
  await t.close();
});

describe("existing logs", () => {
  it("keep every value through the migration", async () => {
    const db = await createTestDatabase({ migrationsBefore: MIGRATION });
    try {
      await db.actAs(null);
      const {
        rows: [mof],
      } = await db.db.query<{ id: string }>(
        `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name, contract_sum)
         values ('MOF-OLD', current_date, $1, 'Old Co', 'Old Project', 1000) returning id`,
        [db.profileIds.sales],
      );
      await db.db.query(
        `insert into public.site_logs (mof_id, visited_on, supervisor_id, activity, notes,
           measurement_received, drive_link, handover_signed)
         values ($1, '2026-11-01', $2, 'others', 'Old note', true, 'https://drive.example/x', true)`,
        [mof.id, db.profileIds.site],
      );
      const read = () =>
        db.db.query(
          `select id, mof_id, visited_on, supervisor_id, activity, notes, measurement_received,
             drive_link, handover_signed, created_at, created_by from public.site_logs`,
        );
      const before = (await read()).rows;

      await applyMigrations(db.db, { from: MIGRATION });

      expect((await read()).rows).toEqual(before);
    } finally {
      await db.close();
    }
  });
});

describe("a site log", () => {
  it("is saved for a new site without an MOF", async () => {
    const projectId = await addProject(t);
    const id = await as("site", () =>
      addLog({
        visited_on: "2026-11-10",
        activity: "inspection",
        site_name: "New showroom, Bangsar",
        salesperson_id: t.profileIds.sales,
        project_id: projectId,
      }),
    );
    expect(await siteLog(id)).toMatchObject({
      mof_id: null,
      site_name: "New showroom, Bangsar",
      salesperson_id: t.profileIds.sales,
      project_id: projectId,
      supervisor_id: t.profileIds.site,
    });
  });

  it("needs an MOF, or a site name and salesperson, not both", async () => {
    await t.actAs("site");
    await expect(
      addLog({ visited_on: "2026-11-10", activity: "inspection" }),
    ).rejects.toThrow(/site_logs_mof_or_new_site/);
    await expect(
      addLog({
        mof_id: mofId,
        visited_on: "2026-11-10",
        activity: "inspection",
        site_name: "Also a name",
      }),
    ).rejects.toThrow(/site_logs_mof_or_new_site/);
  });

  it("keeps per-activity fields on their activity", async () => {
    await t.actAs("site");
    await expect(
      addLog({
        mof_id: mofId,
        visited_on: "2026-11-10",
        activity: "inspection",
        inst_pct: 40,
      }),
    ).rejects.toThrow(/site_logs_inst_pct_installation/);
    const id = await addLog({
      mof_id: mofId,
      visited_on: "2026-11-10",
      activity: "installation",
      inst_pct: 40,
      return_answer: "No balance stock",
    });
    expect(await siteLog(id)).toMatchObject({
      inst_pct: 40,
      return_answer: "No balance stock",
    });
  });

  it("is logged only by the site team, as themselves", async () => {
    await t.actAs("sales");
    await expect(
      addLog({ mof_id: mofId, visited_on: "2026-11-10", activity: "delivery" }),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot be edited by hand", async () => {
    const id = await as("site", () =>
      addLog({ mof_id: mofId, visited_on: "2026-11-10", activity: "delivery" }),
    );
    await t.actAs("site");
    await expect(
      t.db.query(
        "update public.site_logs set delivery_ok = true where id = $1",
        [id],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("after a log is saved", () => {
  it("only the salesperson it went to, or a manager, marks a measurement received", async () => {
    const id = await as("site", () =>
      addLog({
        mof_id: mofId,
        visited_on: "2026-11-10",
        activity: "measurement",
        measurement_to: t.profileIds.sales,
        measurement_sent_on: "2026-11-10",
      }),
    );
    const receive = (jobRole: JobRole) =>
      as(jobRole, () =>
        t.db.query("select public.receive_measurement($1)", [id]),
      );

    await expect(receive("bd")).rejects.toThrow(/salesperson it was sent to/);
    await receive("sales");
    const log = await siteLog(id);
    expect(log.measurement_received).toBe(true);
    expect(log.measurement_received_at).not.toBeNull();
  });

  it("photos are posted by their supervisor, then saved to Drive by the person they went to", async () => {
    const id = await as("site", () =>
      addLog({
        mof_id: mofId,
        visited_on: "2026-11-10",
        activity: "shooting",
        photos_to: t.profileIds.marketing,
      }),
    );
    const save = (jobRole: JobRole) =>
      as(jobRole, () =>
        t.db.query("select public.save_photos_to_drive($1, $2)", [
          id,
          "https://drive.example/folder",
        ]),
      );

    await expect(save("marketing")).rejects.toThrow(/not posted yet/);
    await expect(
      as("sales", () =>
        t.db.query("select public.mark_photos_posted($1)", [id]),
      ),
    ).rejects.toThrow(/supervisor who logged/);
    await as("site", () =>
      t.db.query("select public.mark_photos_posted($1)", [id]),
    );
    await expect(save("sales")).rejects.toThrow(/cannot save them/);
    await save("marketing");

    expect(await siteLog(id)).toMatchObject({
      photos_posted_on: expect.any(Date),
      drive_link: "https://drive.example/folder",
      photos_saved_by: t.profileIds.marketing,
    });
  });
});

describe("follow-ups", () => {
  let followUpId: string;

  beforeAll(async () => {
    const logId = await as("site", () =>
      addLog({ mof_id: mofId, visited_on: "2026-11-10", activity: "delivery" }),
    );
    const { rows } = await as("site", () =>
      t.db.query<{ id: string }>(
        `insert into public.site_follow_ups (site_log_id, action, owner_group, assignee_id)
         values ($1, 'Client to confirm colour', 'client', $2) returning id`,
        [logId, t.profileIds.sales],
      ),
    );
    followUpId = rows[0].id;
  });

  it("the assignee logs still waiting with a snooze date", async () => {
    const snooze = await malaysiaDate(t, 2);
    await as("sales", () =>
      t.db.query(
        `insert into public.site_follow_up_waits (follow_up_id, note, snoozed_until)
         values ($1, 'Called client, will confirm Friday', $2)`,
        [followUpId, snooze],
      ),
    );
    const { rows } = await as("sales", () =>
      t.db.query<{ created_by: string }>(
        "select created_by from public.site_follow_up_waits where follow_up_id = $1",
        [followUpId],
      ),
    );
    expect(rows).toEqual([{ created_by: t.profileIds.sales }]);
  });

  it("someone outside the group cannot log still waiting", async () => {
    await t.actAs("support");
    await expect(
      t.db.query(
        `insert into public.site_follow_up_waits (follow_up_id, note, snoozed_until)
         values ($1, 'Not mine', current_date + 1)`,
        [followUpId],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("the assignee may close it", async () => {
    const { rows } = await as("sales", () =>
      t.db.query<{ id: string }>(
        "update public.site_follow_ups set done_at = now() where id = $1 returning id",
        [followUpId],
      ),
    );
    expect(rows).toHaveLength(1);
  });
});

describe("site off days", () => {
  const addOff = (profileId: string) =>
    t.db.query(
      `insert into public.site_off (profile_id, kind, starts_on, ends_on)
       values ($1, 'office', '2026-11-11', '2026-11-12')`,
      [profileId],
    );

  it("a supervisor adds their own office days, not someone else's", async () => {
    await t.actAs("site");
    await addOff(t.profileIds.site);
    await expect(addOff(t.profileIds.sales)).rejects.toThrow(
      /row-level security/,
    );
  });

  it("only the site team and managers add them", async () => {
    await t.actAs("sales");
    await expect(addOff(t.profileIds.sales)).rejects.toThrow(
      /row-level security/,
    );
  });

  it("refuses a range that ends before it starts", async () => {
    await t.actAs("site");
    await expect(
      t.db.query(
        `insert into public.site_off (kind, starts_on, ends_on)
         values ('other', '2026-11-12', '2026-11-11')`,
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("shooting requests", () => {
  const request = () =>
    t.db.query<{ id: string }>(
      `insert into public.shoot_requests (mof_id, due_on, note)
       values ($1, current_date + 5, 'Feature wall and corridor') returning id`,
      [mofId],
    );
  const setStatus = (id: string, status: string) =>
    t.db.query<{ status: string; done_by: string | null }>(
      "update public.shoot_requests set status = $2 where id = $1 returning status, done_by",
      [id, status],
    );

  it("marketing asks; the site team marks it done, stamped with who", async () => {
    const { rows } = await as("marketing", request);
    await t.actAs("marketing");
    await expect(setStatus(rows[0].id, "done")).rejects.toThrow(
      /row-level security/,
    );
    await t.actAs("site");
    expect((await setStatus(rows[0].id, "done")).rows).toEqual([
      { status: "done", done_by: t.profileIds.site },
    ]);
  });

  it("the requester cancels, the site team cannot", async () => {
    const { rows } = await as("sales", request);
    await t.actAs("site");
    await expect(setStatus(rows[0].id, "cancelled")).rejects.toThrow(
      /row-level security/,
    );
    await t.actAs("sales");
    expect((await setStatus(rows[0].id, "cancelled")).rows).toEqual([
      { status: "cancelled", done_by: null },
    ]);
  });

  it("the site team cannot ask", async () => {
    await t.actAs("site");
    await expect(request()).rejects.toThrow(/row-level security/);
  });
});

describe("what marketing reads", () => {
  it("shooting requests and site logs, not follow-ups or off days", async () => {
    const count = async (table: string) => {
      const { rows } = await as("marketing", () =>
        t.db.query<{ n: number }>(
          `select count(*)::int as n from public.${table}`,
        ),
      );
      return rows[0].n > 0;
    };
    expect({
      shoot_requests: await count("shoot_requests"),
      site_logs: await count("site_logs"),
      site_follow_ups: await count("site_follow_ups"),
      site_follow_up_waits: await count("site_follow_up_waits"),
      site_off: await count("site_off"),
    }).toEqual({
      shoot_requests: true,
      site_logs: true,
      site_follow_ups: false,
      site_follow_up_waits: false,
      site_off: false,
    });
  });
});
