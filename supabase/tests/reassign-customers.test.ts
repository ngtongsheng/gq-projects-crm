import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// The MD or Sales Director gives a customer, or a whole company, to new owners in one step.

let t: TestDatabase;
let counter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function addCompany() {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    "insert into public.companies (name) values ($1) returning id",
    [`Reassign Co ${++counter}`],
  );
  return rows[0].id;
}

async function addCustomer(companyId: string, owner: string, archived = false) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.contacts (company_id, name, mobile, archived_at)
     values ($1, 'Customer', $2, ${archived ? "now()" : "null"}) returning id`,
    [companyId, `6015${String(++counter).padStart(7, "0")}`],
  );
  await t.db.query("delete from public.contact_owners where contact_id = $1", [
    rows[0].id,
  ]);
  await t.db.query(
    "insert into public.contact_owners (contact_id, profile_id) values ($1, $2)",
    [rows[0].id, owner],
  );
  return rows[0].id;
}

async function owners(contactId: string) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ profile_id: string }>(
    "select profile_id from public.contact_owners where contact_id = $1 order by profile_id",
    [contactId],
  );
  return rows.map((row) => row.profile_id);
}

async function reassign(
  as: Parameters<TestDatabase["actAs"]>[0],
  contactId: string,
  newOwners: string[],
  wholeCompany: boolean,
  reason = "Salesperson resigned",
) {
  await t.actAs(as);
  const { rows } = await t.db.query<{ n: number }>(
    "select public.reassign_customers($1, $2::uuid[], $3, $4) as n",
    [contactId, newOwners, wholeCompany, reason],
  );
  return Number(rows[0].n);
}

describe("reassign_customers", () => {
  it("moves the one customer and leaves the company's others", async () => {
    const company = await addCompany();
    const first = await addCustomer(company, t.profileIds.sales);
    const second = await addCustomer(company, t.profileIds.sales);

    expect(await reassign("director", first, [t.profileIds.bd], false)).toBe(1);

    expect(await owners(first)).toEqual([t.profileIds.bd]);
    expect(await owners(second)).toEqual([t.profileIds.sales]);
  });

  it("moves every customer at the company, archived ones left alone", async () => {
    const company = await addCompany();
    const first = await addCustomer(company, t.profileIds.sales);
    const second = await addCustomer(company, t.profileIds.sales);
    const archived = await addCustomer(company, t.profileIds.sales, true);
    const other = await addCustomer(await addCompany(), t.profileIds.sales);

    expect(await reassign("md", first, [t.profileIds.bd], true)).toBe(2);

    expect(await owners(first)).toEqual([t.profileIds.bd]);
    expect(await owners(second)).toEqual([t.profileIds.bd]);
    expect(await owners(archived)).toEqual([t.profileIds.sales]);
    expect(await owners(other)).toEqual([t.profileIds.sales]);
  });

  it("accepts two owners and replaces the old ones", async () => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.sales);

    await reassign(
      "md",
      customer,
      [t.profileIds.bd, t.profileIds.director],
      false,
    );

    expect((await owners(customer)).sort()).toEqual(
      [t.profileIds.bd, t.profileIds.director].sort(),
    );
  });

  it("records who changed it, from whom, to whom and why", async () => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.sales);

    await reassign(
      "director",
      customer,
      [t.profileIds.bd],
      false,
      "  Resigned ",
    );

    await t.actAs("md");
    const { rows } = await t.db.query<{
      changed_by: string;
      from_owners: string[];
      to_owners: string[];
      reason: string;
      whole_company: boolean;
    }>(
      "select changed_by, from_owners, to_owners, reason, whole_company from public.ownership_changes where contact_id = $1",
      [customer],
    );
    expect(rows).toEqual([
      {
        changed_by: t.profileIds.director,
        from_owners: [t.profileIds.sales],
        to_owners: [t.profileIds.bd],
        reason: "Resigned",
        whole_company: false,
      },
    ]);
  });

  it("closes open requests: approved for a new owner, rejected for anyone else", async () => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.director);
    await t.actAs("sales");
    await t.db.query(
      "insert into public.ownership_requests (contact_id, reason) values ($1, 'Mine')",
      [customer],
    );
    await t.actAs("bd");
    await t.db.query(
      "insert into public.ownership_requests (contact_id, reason) values ($1, 'Mine too')",
      [customer],
    );

    await reassign("md", customer, [t.profileIds.sales], false);

    await t.actAs(null);
    const { rows } = await t.db.query<{ requested_by: string; status: string }>(
      "select requested_by, status from public.ownership_requests where contact_id = $1",
      [customer],
    );
    const status = Object.fromEntries(
      rows.map((row) => [row.requested_by, row.status]),
    );
    expect(status[t.profileIds.sales]).toBe("approved");
    expect(status[t.profileIds.bd]).toBe("rejected");
  });

  it.each([
    "sales",
    "bd",
    "accounts",
    "support",
    "site",
  ] as const)("refuses %s", async (role) => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.sales);

    await expect(
      reassign(role, customer, [t.profileIds.bd], false),
    ).rejects.toThrow(/Only the MD or Sales Director/);
    expect(await owners(customer)).toEqual([t.profileIds.sales]);
  });

  it("needs a reason and one or two different owners, and changes nothing otherwise", async () => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.sales);

    await expect(
      reassign("md", customer, [t.profileIds.bd], false, "  "),
    ).rejects.toThrow(/reason/);
    await expect(reassign("md", customer, [], false)).rejects.toThrow(
      /one or two/,
    );
    await expect(
      reassign("md", customer, [t.profileIds.bd, t.profileIds.bd], false),
    ).rejects.toThrow(/different/);
    await expect(
      reassign(
        "md",
        customer,
        [t.profileIds.bd, t.profileIds.director, t.profileIds.sales],
        false,
      ),
    ).rejects.toThrow(/one or two/);
    expect(await owners(customer)).toEqual([t.profileIds.sales]);
  });

  it("says so when the customer does not exist", async () => {
    await expect(
      reassign(
        "md",
        "00000000-0000-4000-8000-000000000000",
        [t.profileIds.bd],
        false,
      ),
    ).rejects.toThrow(/not found/);
  });
});

describe("who reads the ownership history", () => {
  it("is open to managers and closed to salespeople", async () => {
    const company = await addCompany();
    const customer = await addCustomer(company, t.profileIds.sales);
    await reassign("md", customer, [t.profileIds.bd], false);

    for (const [role, expected] of [
      ["md", 1],
      ["director", 1],
      ["accounts", 1],
      ["sales", 0],
      ["bd", 0],
    ] as const) {
      await t.actAs(role);
      const { rows } = await t.db.query<{ n: number }>(
        "select count(*) as n from public.ownership_changes where contact_id = $1",
        [customer],
      );
      expect(Number(rows[0].n)).toBe(expected);
    }
  });
});
