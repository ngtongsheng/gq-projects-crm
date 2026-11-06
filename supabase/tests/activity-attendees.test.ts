import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addContact } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// A salesperson invites colleagues to an activity; the invitation is theirs to change, and only
// salespeople and directors can be invited.

let t: TestDatabase;
let contactId: string;

beforeAll(async () => {
  t = await createTestDatabase();
  contactId = await addContact(t);
});

afterAll(async () => {
  await t.close();
});

async function logActivity(owner: Parameters<TestDatabase["actAs"]>[0]) {
  await t.actAs(null);
  const ownerId = owner === "sales" ? t.profileIds.sales : t.profileIds.bd;
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.activities (contact_id, owner_id, type, purpose, starts_at, status)
     values ($1, $2, 'visit', 'Big presentation', now(), 'planned') returning id`,
    [contactId, ownerId],
  );
  return rows[0].id;
}

async function invite(
  as: Parameters<TestDatabase["actAs"]>[0],
  activityId: string,
  profileId: string,
) {
  await t.actAs(as);
  await t.db.query(
    "insert into public.activity_attendees (activity_id, profile_id) values ($1, $2)",
    [activityId, profileId],
  );
}

async function attendees(activityId: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ profile_id: string }>(
    "select profile_id from public.activity_attendees where activity_id = $1",
    [activityId],
  );
  return rows.map((row) => row.profile_id);
}

describe("inviting colleagues to an activity", () => {
  it("lets the owner invite a senior", async () => {
    const activity = await logActivity("sales");
    await invite("sales", activity, t.profileIds.director);
    expect(await attendees(activity)).toEqual([t.profileIds.director]);
  });

  it("lets the MD or Sales Director invite someone to another person's activity", async () => {
    const activity = await logActivity("sales");
    await invite("md", activity, t.profileIds.bd);
    expect(await attendees(activity)).toEqual([t.profileIds.bd]);
  });

  it("refuses someone who is not the owner, the MD or the Sales Director", async () => {
    const activity = await logActivity("sales");
    await expect(invite("bd", activity, t.profileIds.director)).rejects.toThrow(
      /row-level security/,
    );
  });

  it("refuses to invite the owner to their own activity", async () => {
    const activity = await logActivity("sales");
    await expect(invite("sales", activity, t.profileIds.sales)).rejects.toThrow(
      /row-level security/,
    );
  });

  it.each([
    "accounts",
    "site",
    "support",
  ] as const)("refuses to invite %s", async (role) => {
    const activity = await logActivity("sales");
    await expect(invite("sales", activity, t.profileIds[role])).rejects.toThrow(
      /row-level security/,
    );
  });

  it("invites the same person once", async () => {
    const activity = await logActivity("sales");
    await invite("sales", activity, t.profileIds.director);
    await expect(
      invite("sales", activity, t.profileIds.director),
    ).rejects.toThrow(/duplicate|unique|primary/i);
  });

  it("lets the owner take an invitation back, and nobody else", async () => {
    const activity = await logActivity("sales");
    await invite("sales", activity, t.profileIds.director);

    await t.actAs("bd");
    await t.db.query(
      "delete from public.activity_attendees where activity_id = $1",
      [activity],
    );
    expect(await attendees(activity)).toEqual([t.profileIds.director]);

    await t.actAs("sales");
    await t.db.query(
      "delete from public.activity_attendees where activity_id = $1",
      [activity],
    );
    expect(await attendees(activity)).toEqual([]);
  });

  it("lists who can be invited: salespeople and directors", async () => {
    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string }>(
      "select id from public.sales_colleagues()",
    );
    const ids = rows.map((row) => row.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        t.profileIds.md,
        t.profileIds.director,
        t.profileIds.bd,
        t.profileIds.sales,
      ]),
    );
    expect(ids).not.toContain(t.profileIds.accounts);
    expect(ids).not.toContain(t.profileIds.site);
    expect(ids).not.toContain(t.profileIds.support);
  });
});
