import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 audit S-DB2, S-DB3: weekly reports and activity invitations follow the rule every table
// has, a person who has left reads and writes nothing. The salesperson has left; the MD invited
// them to an activity before they went.

let t: TestDatabase;
let activityId: string;

async function asService<T>(sql: string, params: unknown[] = []) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function asLeaver(sql: string, params: unknown[] = []) {
  await t.actAs("sales");
  return t.db.query(sql, params);
}

beforeAll(async () => {
  t = await createTestDatabase();
  const [company] = await asService<{ id: string }>(
    "insert into public.companies (name) values ('Kayu Sdn Bhd') returning id",
  );
  const [contact] = await asService<{ id: string }>(
    "insert into public.contacts (company_id, name, mobile) values ($1, 'Joyce', '60139000002') returning id",
    [company.id],
  );
  [{ id: activityId }] = await asService<{ id: string }>(
    `insert into public.activities (contact_id, owner_id, type, purpose, starts_at)
     values ($1, $2, 'visit', 'Present samples', now()) returning id`,
    [contact.id, t.profileIds.md],
  );
  await asService(
    "insert into public.activity_invitees (activity_id, profile_id) values ($1, $2)",
    [activityId, t.profileIds.sales],
  );
  await asService(
    "insert into public.weekly_reports (week, profile_id, note) values ('2026-11-02', $1, 'Two quotations out')",
    [t.profileIds.sales],
  );
  await asService(
    "update public.profiles set active = false, left_on = current_date where id = $1",
    [t.profileIds.sales],
  );
});

afterAll(() => t.close());

describe("a salesperson who has left", () => {
  it("cannot submit a weekly report", async () => {
    await expect(
      asLeaver(
        "insert into public.weekly_reports (week, note) values ('2026-11-09', 'Late note')",
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot read their old weekly reports", async () => {
    const { rows } = await asLeaver("select id from public.weekly_reports");
    expect(rows).toEqual([]);
  });

  it("cannot read or answer an invitation", async () => {
    const read = await asLeaver(
      "select status from public.activity_invitees where activity_id = $1",
      [activityId],
    );
    expect(read.rows).toEqual([]);
    const answer = await asLeaver(
      "update public.activity_invitees set status = 'accepted' where activity_id = $1",
      [activityId],
    );
    expect(answer.affectedRows).toBe(0);
  });
});
