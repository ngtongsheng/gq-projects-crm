import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 05 finding 31: a customer and the new company they belong to are saved together or
// not at all.

let t: TestDatabase;
let counter = 0;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

const nextMobile = () => `6014${String(++counter).padStart(7, "0")}`;

const company = (name: string) => ({
  name,
  company_type: "designer",
  rating: 4,
});

const contactFields = (overrides: Record<string, unknown> = {}) => ({
  // A new company has no id yet; the function replaces this.
  company_id: crypto.randomUUID(),
  name: "Lim Wei",
  mobile: nextMobile(),
  title: null,
  rating: 3,
  account_type: "own",
  passed_by: null,
  notes: null,
  ...overrides,
});

type SaveArgs = {
  contactId?: string | null;
  contact: Record<string, unknown>;
  company?: Record<string, unknown> | null;
};

async function saveContact(jobRole: JobRole, args: SaveArgs) {
  await t.actAs(jobRole);
  const { rows } = await t.db.query<{ id: string }>(
    "select public.save_contact($1, $2, $3) as id",
    [
      args.contactId ?? null,
      JSON.stringify(args.contact),
      args.company ? JSON.stringify(args.company) : null,
    ],
  );
  return rows[0].id;
}

async function count(sql: string, params: unknown[]) {
  await t.actAs(null);
  const { rows } = await t.db.query<{ n: number }>(sql, params);
  return Number(rows[0].n);
}

const companiesNamed = (name: string) =>
  count("select count(*) as n from public.companies where name = $1", [name]);

describe("save_contact: a new customer with a new company", () => {
  it("saves the company and the customer, and the creator owns it", async () => {
    const id = await saveContact("sales", {
      contact: contactFields(),
      company: company("Atlas Interiors"),
    });

    expect(await companiesNamed("Atlas Interiors")).toBe(1);
    expect(
      await count(
        `select count(*) as n from public.contacts c
         join public.companies co on co.id = c.company_id
         where c.id = $1 and co.name = 'Atlas Interiors'`,
        [id],
      ),
    ).toBe(1);
    expect(
      await count(
        "select count(*) as n from public.contact_owners where contact_id = $1 and profile_id = $2",
        [id, t.profileIds.sales],
      ),
    ).toBe(1);
  });

  it("keeps no company when the customer fails, and a retry works", async () => {
    const contact = contactFields();

    await expect(
      saveContact("sales", {
        contact: { ...contact, mobile: "not a number" },
        company: company("Retry Interiors"),
      }),
    ).rejects.toThrow(/contacts_mobile_check/);
    expect(await companiesNamed("Retry Interiors")).toBe(0);

    await saveContact("sales", {
      contact,
      company: company("Retry Interiors"),
    });
    expect(await companiesNamed("Retry Interiors")).toBe(1);
  });

  it("keeps no company when the mobile number is already used", async () => {
    const mobile = nextMobile();
    await saveContact("sales", {
      contact: contactFields({ mobile }),
      company: company("First Mobile Co"),
    });

    await expect(
      saveContact("sales", {
        contact: contactFields({ mobile }),
        company: company("Second Mobile Co"),
      }),
    ).rejects.toThrow(/contacts_mobile_key/);
    expect(await companiesNamed("Second Mobile Co")).toBe(0);
  });

  it("refuses a company name already taken", async () => {
    await saveContact("sales", {
      contact: contactFields(),
      company: company("Taken Co"),
    });

    await expect(
      saveContact("sales", {
        contact: contactFields(),
        company: company("taken co"),
      }),
    ).rejects.toThrow(/companies_name_key/);
  });

  it("refuses an account type from a salesperson and keeps no company", async () => {
    await expect(
      saveContact("sales", {
        contact: contactFields({
          account_type: "pass_down",
          passed_by: t.profileIds.bd,
        }),
        company: company("Typed Co"),
      }),
    ).rejects.toThrow(
      "Only the MD or Sales Director can set the account type.",
    );
    expect(await companiesNamed("Typed Co")).toBe(0);
  });

  it("lets the MD set the account type", async () => {
    await expect(
      saveContact("md", {
        contact: contactFields({
          account_type: "pass_down",
          passed_by: t.profileIds.bd,
        }),
        company: company("Passed Co"),
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it("refuses HR & Accounts, who only read, and keeps no company", async () => {
    await expect(
      saveContact("accounts", {
        contact: contactFields(),
        company: company("Accounts Co"),
      }),
    ).rejects.toThrow(/row-level security/);
    expect(await companiesNamed("Accounts Co")).toBe(0);
  });
});

describe("save_contact: an existing company", () => {
  it("saves a customer under a company already listed", async () => {
    const first = await saveContact("sales", {
      contact: contactFields(),
      company: company("Listed Co"),
    });
    await t.actAs(null);
    const { rows } = await t.db.query<{ company_id: string }>(
      "select company_id from public.contacts where id = $1",
      [first],
    );

    const second = await saveContact("sales", {
      contact: contactFields({ company_id: rows[0].company_id }),
    });

    expect(
      await count(
        "select count(*) as n from public.contacts where id = $1 and company_id = $2",
        [second, rows[0].company_id],
      ),
    ).toBe(1);
    expect(await companiesNamed("Listed Co")).toBe(1);
  });
});

describe("save_contact: an existing customer", () => {
  async function added() {
    const contact = contactFields();
    const id = await saveContact("sales", {
      contact,
      company: company(`Edit Co ${++counter}`),
    });
    await t.actAs(null);
    const { rows } = await t.db.query<{ company_id: string }>(
      "select company_id from public.contacts where id = $1",
      [id],
    );
    return { id, contact: { ...contact, company_id: rows[0].company_id } };
  }

  it("lets an owner change the customer", async () => {
    const { id, contact } = await added();

    await saveContact("sales", {
      contactId: id,
      contact: { ...contact, name: "Renamed" },
    });

    expect(
      await count(
        "select count(*) as n from public.contacts where id = $1 and name = 'Renamed'",
        [id],
      ),
    ).toBe(1);
  });

  it("moves the customer to a new company in the same save", async () => {
    const { id, contact } = await added();

    await saveContact("sales", {
      contactId: id,
      contact,
      company: company("Moved To Co"),
    });

    expect(
      await count(
        `select count(*) as n from public.contacts c
         join public.companies co on co.id = c.company_id
         where c.id = $1 and co.name = 'Moved To Co'`,
        [id],
      ),
    ).toBe(1);
  });

  it("refuses someone who is not an owner and keeps no company", async () => {
    const { id, contact } = await added();

    await expect(
      saveContact("bd", {
        contactId: id,
        contact: { ...contact, name: "Hijacked" },
        company: company("Hijack Co"),
      }),
    ).rejects.toThrow(/Only the owners/);
    expect(await companiesNamed("Hijack Co")).toBe(0);
  });
});
