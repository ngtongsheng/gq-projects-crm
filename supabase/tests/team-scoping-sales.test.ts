import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 D6: Eddie (director) and Vanessa (bd) each read only their own team's companies,
// customers, activities and projects. The MD and HR & Accounts read all; other roles as before.

type Records = {
  companyId: string;
  contactId: string;
  activityId: string;
  projectId: string;
};
type Table = "companies" | "contacts" | "activities" | "projects";

let t: TestDatabase;
let beeId: string;
let eddieTeam: Records;
let vanessaTeam: Records;

async function asService<T>(sql: string, params: unknown[]) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

/** A company, customer, activity and project, all owned by one salesperson. */
async function addSalesRecords(ownerId: string, n: number): Promise<Records> {
  const [company] = await asService<{ id: string }>(
    "insert into public.companies (name) values ($1) returning id",
    [`Team Co ${n}`],
  );
  const [contact] = await asService<{ id: string }>(
    "insert into public.contacts (company_id, name, mobile) values ($1, 'Contact', $2) returning id",
    [company.id, `60139${String(n).padStart(6, "0")}`],
  );
  await asService(
    "insert into public.contact_owners (contact_id, profile_id) values ($1, $2)",
    [contact.id, ownerId],
  );
  const [activity] = await asService<{ id: string }>(
    `insert into public.activities (contact_id, owner_id, type, purpose, starts_at)
     values ($1, $2, 'call', 'Follow up', now()) returning id`,
    [contact.id, ownerId],
  );
  const [project] = await asService<{ id: string }>(
    `insert into public.projects (contact_id, name, lead_source, pic_id)
     values ($1, 'Team project', 'referral', $2) returning id`,
    [contact.id, ownerId],
  );
  return {
    companyId: company.id,
    contactId: contact.id,
    activityId: activity.id,
    projectId: project.id,
  };
}

async function actAsId(profileId: string) {
  await t.db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    profileId,
  ]);
  await t.db.exec("set role authenticated");
}

async function visible(who: JobRole | string, table: Table) {
  if (t.profileIds[who as JobRole]) await t.actAs(who as JobRole);
  else await actAsId(who);
  const { rows } = await t.db.query<{ id: string }>(
    `select id from public.${table}`,
  );
  return rows.map((row) => row.id);
}

const idOf = (records: Records, table: Table) =>
  ({
    companies: records.companyId,
    contacts: records.contactId,
    activities: records.activityId,
    projects: records.projectId,
  })[table];

const tables: Table[] = ["companies", "contacts", "activities", "projects"];

beforeAll(async () => {
  t = await createTestDatabase();
  [{ id: beeId }] = await asService<{ id: string }>(
    "insert into auth.users (email) values ('bee@test.local') returning id",
    [],
  );
  await asService(
    "update public.profiles set job_role = 'sales', reports_to = $1 where id = $2",
    [t.profileIds.bd, beeId],
  );
  await asService("update public.profiles set reports_to = $1 where id = $2", [
    t.profileIds.director,
    t.profileIds.sales,
  ]);
  eddieTeam = await addSalesRecords(t.profileIds.sales, 1);
  vanessaTeam = await addSalesRecords(beeId, 2);
});

afterAll(async () => {
  await t.close();
});

describe.each(tables)("who reads which %s", (table) => {
  it("a director reads their own team's, not another team's", async () => {
    const rows = await visible("director", table);
    expect(rows).toContain(idOf(eddieTeam, table));
    expect(rows).not.toContain(idOf(vanessaTeam, table));
  });

  it("a Marketing Director reads their own team's, not another team's", async () => {
    const rows = await visible("bd", table);
    expect(rows).toContain(idOf(vanessaTeam, table));
    expect(rows).not.toContain(idOf(eddieTeam, table));
  });

  it.each([
    "md",
    "accounts",
  ] as const)("%s reads both teams'", async (jobRole) => {
    const rows = await visible(jobRole, table);
    expect(rows).toContain(idOf(eddieTeam, table));
    expect(rows).toContain(idOf(vanessaTeam, table));
  });
});

describe("a Site Supervisor", () => {
  it.each([
    "companies",
    "contacts",
    "activities",
  ] as const)("reads both teams' %s", async (table) => {
    const rows = await visible("site", table);
    expect(rows).toContain(idOf(eddieTeam, table));
    expect(rows).toContain(idOf(vanessaTeam, table));
  });

  it("reads neither team's projects (loop 12 task 09)", async () => {
    expect(await visible("site", "projects")).toEqual([]);
  });
});

describe("a salesperson", () => {
  it.each([
    "companies",
    "contacts",
    "activities",
  ] as const)("still reads every team's %s", async (table) => {
    const rows = await visible(beeId, table);
    expect(rows).toContain(idOf(eddieTeam, table));
    expect(rows).toContain(idOf(vanessaTeam, table));
  });

  it("still reads only their own projects", async () => {
    expect(await visible(beeId, "projects")).toEqual([vanessaTeam.projectId]);
  });
});

describe("a director adding a customer", () => {
  it("reads back the company and customer they just added", async () => {
    await t.actAs("director");
    const { rows } = await t.db.query<{ id: string }>(
      `select public.save_contact(null, $1, $2) as id`,
      [
        { name: "New Contact", mobile: "60139999999", account_type: "own" },
        { name: "Director New Co", company_type: "designer", rating: 3 },
      ],
    );
    const contactId = rows[0].id;
    expect(await visible("director", "contacts")).toContain(contactId);
    const { rows: companies } = await t.db.query<{ name: string }>(
      "select co.name from public.companies co join public.contacts c on c.company_id = co.id where c.id = $1",
      [contactId],
    );
    expect(companies).toEqual([{ name: "Director New Co" }]);
  });
});

describe("a director and work on someone else's customer", () => {
  it("reads the customer and company behind their team's project", async () => {
    const [project] = await asService<{ id: string }>(
      `insert into public.projects (contact_id, name, lead_source, pic_id)
       values ($1, 'Cross-team project', 'referral', $2) returning id`,
      [vanessaTeam.contactId, t.profileIds.sales],
    );
    expect(await visible("director", "projects")).toContain(project.id);
    expect(await visible("director", "contacts")).toContain(
      vanessaTeam.contactId,
    );
    expect(await visible("director", "companies")).toContain(
      vanessaTeam.companyId,
    );
  });
});
