import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { addContact } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Finding 55: BD and Sales read only the projects they are on; everyone else reads all.
// Loop 11 D6: a director reads their team's; this salesperson reports to no one.

let t: TestDatabase;
let ids: Record<"others" | "supported" | "passedDown" | "led", string>;

async function addProject(
  name: string,
  pic: JobRole,
  support: JobRole | null,
  passedBy: JobRole | null,
) {
  const contactId = await addContact(t);
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.projects (contact_id, name, lead_source, pic_id, support_id, passed_by, commission_type)
     values ($1, $2, 'referral', $3, $4, $5, $6) returning id`,
    [
      contactId,
      name,
      t.profileIds[pic],
      support && t.profileIds[support],
      passedBy && t.profileIds[passedBy],
      passedBy ? "pass_down" : "own",
    ],
  );
  return rows[0].id;
}

async function visibleTo(jobRole: JobRole) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ id: string }>(
    "select id from public.projects",
  );
  return rows.map((row) => row.id).sort();
}

beforeAll(async () => {
  t = await createTestDatabase();
  ids = {
    others: await addProject("Someone else's", "director", null, null),
    supported: await addProject("Sales supports", "director", "sales", null),
    passedDown: await addProject("BD passed down", "director", null, "bd"),
    led: await addProject("Sales leads", "sales", null, null),
  };
});

afterAll(async () => {
  await t.close();
});

describe("who reads which projects", () => {
  it.each([
    "md",
    "accounts",
    "site",
    "support",
  ] as const)("%s reads every project", async (jobRole) => {
    expect(await visibleTo(jobRole)).toEqual(Object.values(ids).sort());
  });

  it("director reads only their own team's projects", async () => {
    expect(await visibleTo("director")).toEqual(
      [ids.others, ids.supported, ids.passedDown].sort(),
    );
  });

  it("sales reads only the projects they lead or support", async () => {
    expect(await visibleTo("sales")).toEqual([ids.supported, ids.led].sort());
  });

  it("bd reads only the projects they passed down", async () => {
    expect(await visibleTo("bd")).toEqual([ids.passedDown]);
  });
});
