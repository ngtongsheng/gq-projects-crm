import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 12 task 04: activity invitees, outcome stamps and weekly reports. The salesperson
// (sales) reports to Eddie (director); Vanessa (bd) leads another team.

let t: TestDatabase;
let contactId: string;

async function asService<T>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function as<T>(jobRole: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(jobRole);
  const { rows, affectedRows } = await t.db.query<T>(sql, params);
  return { rows, affectedRows };
}

async function addActivity(status = "planned", startsAt = "now()") {
  const [activity] = await asService<{ id: string }>(
    `insert into public.activities (contact_id, owner_id, type, purpose, starts_at, status)
     values ($1, $2, 'visit', 'Present samples', ${startsAt}, $3) returning id`,
    [contactId, t.profileIds.sales, status],
  );
  return activity.id;
}

async function submitReport(jobRole: JobRole, week: string) {
  const { rows } = await as<{ id: string; late: boolean; profile_id: string }>(
    jobRole,
    `insert into public.weekly_reports (week, note) values ($1, 'Two quotations out')
     returning id, late, profile_id`,
    [week],
  );
  return rows[0];
}

const review = (jobRole: JobRole, id: string) =>
  as(
    jobRole,
    "update public.weekly_reports set status = 'reviewed' where id = $1",
    [id],
  );

beforeAll(async () => {
  t = await createTestDatabase();
  await asService("update public.profiles set reports_to = $1 where id = $2", [
    t.profileIds.director,
    t.profileIds.sales,
  ]);
  const [company] = await asService<{ id: string }>(
    "insert into public.companies (name) values ('Kayu Sdn Bhd') returning id",
  );
  [{ id: contactId }] = await asService<{ id: string }>(
    "insert into public.contacts (company_id, name, mobile) values ($1, 'Joyce', '60139000001') returning id",
    [company.id],
  );
  await asService(
    "insert into public.contact_owners (contact_id, profile_id) values ($1, $2)",
    [contactId, t.profileIds.sales],
  );
});

afterAll(async () => {
  await t.close();
});

describe("activity invitees", () => {
  it("an invited Marketing Director reads an activity outside their team", async () => {
    const activityId = await addActivity();
    const read = () =>
      as("bd", "select id from public.activities where id = $1", [activityId]);
    expect((await read()).rows).toEqual([]);

    await as(
      "sales",
      "insert into public.activity_invitees (activity_id, profile_id) values ($1, $2)",
      [activityId, t.profileIds.bd],
    );

    expect((await read()).rows).toEqual([{ id: activityId }]);
  });

  it("only the invitee answers; the inviter can only send it again", async () => {
    const activityId = await addActivity();
    await as(
      "sales",
      "insert into public.activity_invitees (activity_id, profile_id) values ($1, $2)",
      [activityId, t.profileIds.md],
    );
    const setStatus = (jobRole: JobRole, status: string) =>
      as(
        jobRole,
        "update public.activity_invitees set status = $1 where activity_id = $2",
        [status, activityId],
      );

    await expect(setStatus("sales", "accepted")).rejects.toThrow(
      /Only the invited colleague/,
    );
    expect((await setStatus("accounts", "accepted")).affectedRows).toBe(0);

    await setStatus("md", "declined");
    const { rows } = await as<{ status: string; answered: boolean }>(
      "sales",
      "select status, answered_at is not null as answered from public.activity_invitees where activity_id = $1",
      [activityId],
    );
    expect(rows).toEqual([{ status: "declined", answered: true }]);
  });

  it("refuses inviting the activity's own salesperson", async () => {
    const activityId = await addActivity();
    await expect(
      as(
        "sales",
        "insert into public.activity_invitees (activity_id, profile_id) values ($1, $2)",
        [activityId, t.profileIds.sales],
      ),
    ).rejects.toThrow(/can't be invited/);
  });
});

describe("activity outcomes", () => {
  it("stamps logged_at on completion and flags a visit logged after its week's deadline", async () => {
    const activityId = await addActivity(
      "planned",
      "now() - interval '14 days'",
    );
    await as(
      "sales",
      `update public.activities
       set status = 'completed', result = 'quotation_requested', outcome = 'Doing two offices in Q1.'
       where id = $1`,
      [activityId],
    );
    const { rows } = await as<{ logged: boolean; late_logged: boolean }>(
      "sales",
      "select logged_at is not null as logged, late_logged from public.activities where id = $1",
      [activityId],
    );
    expect(rows).toEqual([{ logged: true, late_logged: true }]);
  });

  it("keeps the stamps when the client tries to change them", async () => {
    const activityId = await addActivity();
    await expect(
      as(
        "sales",
        "update public.activities set late_logged = true where id = $1",
        [activityId],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("weekly reports", () => {
  it("a salesperson submits only their own, stamped late after the deadline", async () => {
    const report = await submitReport("sales", "2026-11-02");
    expect(report.profile_id).toBe(t.profileIds.sales);
    expect(report.late).toBe(true);

    await expect(
      as(
        "sales",
        "insert into public.weekly_reports (week, profile_id) values ('2026-10-26', $1)",
        [t.profileIds.director],
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("a salesperson cannot mark their own report reviewed", async () => {
    const report = await submitReport("sales", "2026-10-19");
    expect((await review("sales", report.id)).affectedRows).toBe(0);
  });

  it("the team lead marks it reviewed", async () => {
    const report = await submitReport("sales", "2026-10-12");
    expect((await review("director", report.id)).affectedRows).toBe(1);
    const { rows } = await as<{ status: string; reviewed_by: string }>(
      "sales",
      "select status, reviewed_by from public.weekly_reports where id = $1",
      [report.id],
    );
    expect(rows).toEqual([
      { status: "reviewed", reviewed_by: t.profileIds.director },
    ]);
  });

  it("the MD marks it reviewed", async () => {
    const report = await submitReport("sales", "2026-10-05");
    expect((await review("md", report.id)).affectedRows).toBe(1);
  });

  it("another team's director neither reads nor reviews it", async () => {
    const report = await submitReport("sales", "2026-09-28");
    const { rows } = await as(
      "bd",
      "select id from public.weekly_reports where id = $1",
      [report.id],
    );
    expect(rows).toEqual([]);
    expect((await review("bd", report.id)).affectedRows).toBe(0);
  });

  it("refuses a report from someone who does not file one", async () => {
    await expect(submitReport("site", "2026-11-02")).rejects.toThrow(
      /row-level security/,
    );
  });
});
