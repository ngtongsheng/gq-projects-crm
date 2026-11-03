import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Finding 1 (loop 05): account type and passed-by set the commission rate, so only the MD
// or Sales Director may set them, and HR & Accounts never edits customers.

let t: TestDatabase;
let mobileCounter = 0;
const nextMobile = () => `6012${String(++mobileCounter).padStart(7, "0")}`;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function addCompany(name: string, accountType: string | null = null) {
  const { rows } = await t.db.query<{ id: string }>(
    "insert into public.companies (name, account_type) values ($1, $2) returning id",
    [name, accountType],
  );
  return rows[0].id;
}

async function addContact(
  companyId: string,
  accountType = "own",
  passedBy: string | null = null,
) {
  const { rows } = await t.db.query<{ id: string }>(
    "insert into public.contacts (company_id, name, mobile, account_type, passed_by) values ($1, $2, $3, $4, $5) returning id",
    [companyId, "Contact", nextMobile(), accountType, passedBy],
  );
  return rows[0].id;
}

describe("sales", () => {
  beforeAll(() => t.actAs("sales"));

  it("adds a company and a contact with the default account type", async () => {
    const companyId = await addCompany("Sales Plain Co");
    await expect(addContact(companyId)).resolves.toEqual(expect.any(String));
  });

  it("cannot set a company's account type", async () => {
    await expect(addCompany("Sales Typed Co", "company")).rejects.toThrow(
      "Only the MD or Sales Director can set the account type.",
    );
  });

  it("cannot add a contact as pass-down with passed-by", async () => {
    const companyId = await addCompany("Sales Pass Co");
    await expect(
      addContact(companyId, "pass_down", t.profileIds.bd),
    ).rejects.toThrow(
      "Only the MD or Sales Director can set the account type.",
    );
  });

  it("edits their own contact but cannot change its account type", async () => {
    const companyId = await addCompany("Sales Owned Co");
    const contactId = await addContact(companyId);

    await expect(
      t.db.query("update public.contacts set notes = 'met' where id = $1", [
        contactId,
      ]),
    ).resolves.toMatchObject({ affectedRows: 1 });

    await expect(
      t.db.query(
        "update public.contacts set account_type = 'pass_down', passed_by = $1 where id = $2",
        [t.profileIds.bd, contactId],
      ),
    ).rejects.toThrow(
      "Only the MD or Sales Director can change the account type.",
    );
  });
});

describe.each(["md", "director"] as const)("%s", (jobRole) => {
  beforeAll(() => t.actAs(jobRole));

  it("sets account type and passed-by when adding", async () => {
    const companyId = await addCompany(`${jobRole} Typed Co`, "company");
    await expect(
      addContact(companyId, "pass_down", t.profileIds.bd),
    ).resolves.toEqual(expect.any(String));
  });

  it("changes a salesperson's contact to pass-down", async () => {
    await t.actAs("sales");
    const contactId = await addContact(
      await addCompany(`${jobRole} Reassign Co`),
    );
    await t.actAs(jobRole);

    await expect(
      t.db.query(
        "update public.contacts set account_type = 'pass_down', passed_by = $1 where id = $2",
        [t.profileIds.sales, contactId],
      ),
    ).resolves.toMatchObject({ affectedRows: 1 });
  });
});

describe("accounts", () => {
  it("cannot edit a contact even when made its owner", async () => {
    await t.actAs("md");
    const contactId = await addContact(await addCompany("Accounts Owned Co"));
    await t.actAs(null);
    await t.db.query(
      "update public.contact_owners set profile_id = $1 where contact_id = $2",
      [t.profileIds.accounts, contactId],
    );
    await t.actAs("accounts");

    await expect(
      t.db.query("update public.contacts set notes = 'edited' where id = $1", [
        contactId,
      ]),
    ).rejects.toThrow("HR & Accounts can view customers but not change them.");
  });
});
