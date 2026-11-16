import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 24 audit S-DB1: a file goes into <area>/<record-id>/ only when the person may change that
// record, by the same rule as the table the file is recorded on. Every upload area the app has:
// claims, leave, tasks, hr-policies.

let t: TestDatabase;
let claimId: string;
let leaveId: string;
let taskId: string;
const NEW_POLICY_ID = "7b1d2c3e-4f50-4a6b-8c7d-9e0f1a2b3c4d";

async function insertAs(who: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(who);
  const { rows } = await t.db.query<{ id: string }>(sql, params);
  return rows[0].id;
}

/** Adds a file as this person into <area>/<record>/; rejects when the storage policy refuses. */
async function attach(who: JobRole, area: string, record: string) {
  await t.actAs(who);
  await t.db.query(
    "insert into storage.objects (bucket_id, name, owner_id) values ('attachments', $1, $2)",
    [
      `${area}/${record}/${crypto.randomUUID().slice(0, 8)}-file.jpg`,
      t.profileIds[who],
    ],
  );
}

const refused = (who: JobRole, area: string, record: string) =>
  expect(attach(who, area, record)).rejects.toThrow(/row-level security/);

beforeAll(async () => {
  t = await createTestDatabase();
  claimId = await insertAs(
    "sales",
    "insert into public.monthly_claims (month) values ('2026-10-01') returning id",
  );
  leaveId = await insertAs(
    "sales",
    `insert into public.leave_requests (leave_type, starts_on, ends_on)
     values ('mc', '2027-01-04', '2027-01-04') returning id`,
  );
  taskId = await insertAs(
    "marketing",
    `insert into public.tasks (title, category, assignee_id, priority, due_on)
     values ('Brochure', 'e_catalogue', $1, 'high', current_date + 3) returning id`,
    [t.profileIds.designer],
  );
});

afterAll(() => t.close());

describe("claim receipts", () => {
  it("the person adds to their own open claim", async () => {
    await attach("sales", "claims", claimId);
  });

  it("another person cannot, nor HR & Accounts before it is submitted", async () => {
    await refused("designer", "claims", claimId);
    await refused("accounts", "claims", claimId);
  });

  it("nobody adds to a claim that does not exist", async () => {
    await refused("sales", "claims", crypto.randomUUID());
  });
});

describe("leave slips", () => {
  it("the person, the MD and HR & Accounts add to the leave", async () => {
    await attach("sales", "leave", leaveId);
    await attach("md", "leave", leaveId);
    await attach("accounts", "leave", leaveId);
  });

  it("another person cannot, nor the team lead", async () => {
    await refused("designer", "leave", leaveId);
    await refused("bd", "leave", leaveId);
  });

  it("nobody adds to a leave that does not exist", async () => {
    await refused("md", "leave", crypto.randomUUID());
  });
});

describe("task files", () => {
  it("the assigner and the assignee add to the task", async () => {
    await attach("marketing", "tasks", taskId);
    await attach("designer", "tasks", taskId);
  });

  it("someone not on the task cannot, even the MD", async () => {
    await refused("sales", "tasks", taskId);
    await refused("md", "tasks", taskId);
  });
});

describe("HR policy documents", () => {
  it("the MD and HR & Accounts add before the document is saved", async () => {
    await attach("accounts", "hr-policies", NEW_POLICY_ID);
    await attach("md", "hr-policies", NEW_POLICY_ID);
  });

  it("nobody else does", async () => {
    await refused("sales", "hr-policies", NEW_POLICY_ID);
    await refused("director", "hr-policies", NEW_POLICY_ID);
  });
});

describe("an area the app does not have", () => {
  it("is refused to everyone, even the MD", async () => {
    await refused("md", "photos", claimId);
  });
});

describe("a person who has left", () => {
  it("cannot add to what was their own claim", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false, left_on = current_date where id = $1",
      [t.profileIds.sales],
    );
    await refused("sales", "claims", claimId);
  });
});
