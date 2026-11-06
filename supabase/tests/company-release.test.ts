import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// A company nobody has visited for 90 days is released: a salesperson may ask for the whole
// company, and approving makes the requester the owner of all its customers.

let t: TestDatabase;
let counter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function addCompany(ageDays: number) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.companies (name, created_at)
     values ($1, now() - ($2 || ' days')::interval) returning id`,
    [`Release Co ${++counter}`, ageDays],
  );
  return rows[0].id;
}

async function addCustomer(companyId: string, archived = false) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.contacts (company_id, name, mobile, archived_at)
     values ($1, 'Customer', $2, ${archived ? "now()" : "null"}) returning id`,
    [companyId, `6014${String(++counter).padStart(7, "0")}`],
  );
  // Whoever adds a customer becomes its owner: here nobody, so give it to the Sales Director.
  await t.db.query("delete from public.contact_owners where contact_id = $1", [
    rows[0].id,
  ]);
  await t.db.query(
    "insert into public.contact_owners (contact_id, profile_id) values ($1, $2)",
    [rows[0].id, t.profileIds.director],
  );
  return rows[0].id;
}

async function visit(
  contactId: string,
  daysAgo: number,
  type = "visit",
  status = "completed",
) {
  await t.actAs(null);
  await t.db.query(
    `insert into public.activities (contact_id, owner_id, type, purpose, starts_at, status)
     values ($1, $2, $3, 'Check in', now() - ($4 || ' days')::interval, $5)`,
    [contactId, t.profileIds.director, type, daysAgo, status],
  );
}

async function released(companyId: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ r: boolean }>(
    "select public.company_is_released($1) as r",
    [companyId],
  );
  return rows[0].r;
}

async function ask(contactId: string, wholeCompany: boolean) {
  await t.actAs("sales");
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.ownership_requests (contact_id, reason, whole_company)
     values ($1, 'Please', $2) returning id`,
    [contactId, wholeCompany],
  );
  return rows[0].id;
}

describe("company_is_released", () => {
  it("is released with no visit for more than 90 days", async () => {
    const company = await addCompany(200);
    const customer = await addCustomer(company);
    await visit(customer, 120);
    expect(await released(company)).toBe(true);
  });

  it("is kept by a completed visit or site visit within 90 days, by any customer", async () => {
    const company = await addCompany(200);
    const first = await addCustomer(company);
    const second = await addCustomer(company);
    await visit(first, 120);
    await visit(second, 30, "site_visit");
    expect(await released(company)).toBe(false);
  });

  it("is not kept by a call, a planned visit or a cancelled one", async () => {
    const company = await addCompany(200);
    const customer = await addCustomer(company);
    await visit(customer, 10, "call");
    await visit(customer, 10, "visit", "planned");
    await visit(customer, 10, "visit", "cancelled");
    expect(await released(company)).toBe(true);
  });

  it("is not released while the company is younger than 90 days", async () => {
    const company = await addCompany(30);
    await addCustomer(company);
    expect(await released(company)).toBe(false);
  });
});

describe("asking for a whole company", () => {
  it("is allowed while the company is released", async () => {
    const company = await addCompany(200);
    const customer = await addCustomer(company);
    await expect(ask(customer, true)).resolves.toEqual(expect.any(String));
  });

  it("is refused while someone has visited it lately", async () => {
    const company = await addCompany(200);
    const customer = await addCustomer(company);
    await visit(customer, 20);
    await expect(ask(customer, true)).rejects.toThrow(/row-level security/);
  });

  it("still allows a request for one customer of a company that is not released", async () => {
    const company = await addCompany(200);
    const customer = await addCustomer(company);
    await visit(customer, 20);
    await expect(ask(customer, false)).resolves.toEqual(expect.any(String));
  });
});

describe("approving a whole-company request", () => {
  async function owners(contactId: string) {
    await t.actAs(null);
    const { rows } = await t.db.query<{ profile_id: string }>(
      "select profile_id from public.contact_owners where contact_id = $1",
      [contactId],
    );
    return rows.map((row) => row.profile_id);
  }

  it("makes the requester the owner of every customer at the company, archived ones left alone", async () => {
    const company = await addCompany(200);
    const first = await addCustomer(company);
    const second = await addCustomer(company);
    const archived = await addCustomer(company, true);
    const other = await addCustomer(await addCompany(200));
    const request = await ask(first, true);

    await t.actAs("director");
    await t.db.query("select public.decide_ownership_request($1, true)", [
      request,
    ]);

    expect(await owners(first)).toEqual([t.profileIds.sales]);
    expect(await owners(second)).toEqual([t.profileIds.sales]);
    expect(await owners(archived)).toEqual([t.profileIds.director]);
    expect(await owners(other)).toEqual([t.profileIds.director]);
  });

  it("moves only the one customer for an ordinary request", async () => {
    const company = await addCompany(200);
    const first = await addCustomer(company);
    const second = await addCustomer(company);
    const request = await ask(first, false);

    await t.actAs("director");
    await t.db.query("select public.decide_ownership_request($1, true)", [
      request,
    ]);

    expect(await owners(first)).toEqual([t.profileIds.sales]);
    expect(await owners(second)).toEqual([t.profileIds.director]);
  });

  it("changes no owner when rejected", async () => {
    const company = await addCompany(200);
    const first = await addCustomer(company);
    const second = await addCustomer(company);
    const request = await ask(first, true);

    await t.actAs("md");
    await t.db.query("select public.decide_ownership_request($1, false)", [
      request,
    ]);

    expect(await owners(first)).toEqual([t.profileIds.director]);
    expect(await owners(second)).toEqual([t.profileIds.director]);
  });
});
