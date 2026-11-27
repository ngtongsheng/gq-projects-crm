import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 25 task 09: Marketing expense (demo vMkt). The page's readers (md, accounts, ssup, support,
// marketing) read every marketing table; the same minus HR & Accounts write. Records link by id, so
// a rename shows everywhere and a record in use cannot be deleted.

let t: TestDatabase;

const EDITORS: JobRole[] = ["md", "ssup", "support", "marketing"];
const OUTSIDERS: JobRole[] = ["director", "bd", "sales", "site", "designer"];

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

async function query<Row>(as: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(as);
  const { rows } = await t.db.query<Row>(sql, params);
  return rows;
}

let vendorCount = 0;

async function addVendor(as: JobRole = "marketing", name?: string) {
  vendorCount += 1;
  const rows = await query<{ id: string }>(
    as,
    "insert into public.marketing_vendors (name) values ($1) returning id",
    [name ?? `Vendor ${vendorCount}`],
  );
  return rows[0].id;
}

async function categoryId(name: string) {
  const rows = await query<{ id: string }>(
    "md",
    "select id from public.marketing_categories where name = $1",
    [name],
  );
  return rows[0].id;
}

async function addExpense(
  as: JobRole,
  {
    vendorId,
    categoryName = "Folder",
  }: { vendorId: string; categoryName?: string },
) {
  const rows = await query<{ id: string }>(
    as,
    `insert into public.marketing_expenses (category_id, description, vendor_id, amount, amount_rm)
     values ($1, 'Sample folders', $2, 450, 450) returning id`,
    [await categoryId(categoryName), vendorId],
  );
  return rows[0].id;
}

const deleteFrom = (as: JobRole, table: string, id: string) =>
  query<{ id: string }>(
    as,
    `delete from public.${table} where id = $1 returning id`,
    [id],
  );

describe("categories", () => {
  it("seeds the 11 demo categories in order", async () => {
    const rows = await query<{ name: string }>(
      "accounts",
      "select name from public.marketing_categories order by sort_order",
    );
    expect(rows.map((r) => r.name)).toEqual([
      "Folder",
      "Full Piece Sample",
      "Wallpaper Book",
      "Printing & Stationery",
      "Graphic Design & Branding",
      "Digital Marketing",
      "Logistics & Courier",
      "Events & Exhibitions",
      "Wallpaper Design",
      "Merchandise & Gifts",
      "Others",
    ]);
  });

  it("refuses a name that differs only in case", async () => {
    await expect(
      query(
        "marketing",
        "insert into public.marketing_categories (name) values ('folder')",
      ),
    ).rejects.toThrow();
  });

  it("a category in use cannot be deleted; an unused one can", async () => {
    await addExpense("marketing", {
      vendorId: await addVendor(),
      categoryName: "Wallpaper Book",
    });
    await expect(
      deleteFrom(
        "md",
        "marketing_categories",
        await categoryId("Wallpaper Book"),
      ),
    ).rejects.toThrow(/foreign key/);
    const [unused] = await query<{ id: string }>(
      "marketing",
      "insert into public.marketing_categories (name, sort_order) values ('Trade fair', 12) returning id",
    );
    expect(
      await deleteFrom("marketing", "marketing_categories", unused.id),
    ).toHaveLength(1);
  });

  it("a renamed category shows on its expenses", async () => {
    const id = await categoryId("Merchandise & Gifts");
    const expense = await addExpense("marketing", {
      vendorId: await addVendor(),
      categoryName: "Merchandise & Gifts",
    });
    await query(
      "marketing",
      "update public.marketing_categories set name = 'Gifts' where id = $1",
      [id],
    );
    const rows = await query<{ name: string }>(
      "accounts",
      `select c.name from public.marketing_expenses e
       join public.marketing_categories c on c.id = e.category_id where e.id = $1`,
      [expense],
    );
    expect(rows).toEqual([{ name: "Gifts" }]);
  });
});

describe("vendors", () => {
  it("a vendor rename shows on its expenses", async () => {
    const vendorId = await addVendor("marketing", "Best Print");
    const expense = await addExpense("support", { vendorId });
    await query(
      "marketing",
      "update public.marketing_vendors set name = 'Best Print Sdn Bhd' where id = $1",
      [vendorId],
    );
    const rows = await query<{ name: string }>(
      "md",
      `select v.name from public.marketing_expenses e
       join public.marketing_vendors v on v.id = e.vendor_id where e.id = $1`,
      [expense],
    );
    expect(rows).toEqual([{ name: "Best Print Sdn Bhd" }]);
  });

  it("names are unique whatever the case", async () => {
    await addVendor("marketing", "Courier Co");
    await expect(addVendor("marketing", "COURIER CO")).rejects.toThrow();
  });

  it("a part-timer without phone or email is refused", async () => {
    const add = (contact: string) =>
      query(
        "marketing",
        `insert into public.marketing_vendors (kind, name, skills ${contact ? ", phone" : ""})
         values ('part_timer', $1, '{photography}' ${contact ? ", $2" : ""})`,
        contact ? [`Ali ${contact}`, contact] : ["Ali"],
      );
    await expect(add("")).rejects.toThrow(/check constraint/);
    await expect(add("012-3456789")).resolves.toBeDefined();
  });

  it("a vendor with expenses cannot be deleted", async () => {
    const vendorId = await addVendor();
    await addExpense("marketing", { vendorId });
    await expect(
      deleteFrom("md", "marketing_vendors", vendorId),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("expenses", () => {
  it("in RM the RM amount is the amount", async () => {
    await expect(
      query(
        "marketing",
        `insert into public.marketing_expenses (category_id, description, vendor_id, amount, amount_rm)
         values ($1, 'Stickers', $2, 320, 300)`,
        [await categoryId("Folder"), await addVendor()],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("stamps who made the last change", async () => {
    const expense = await addExpense("marketing", {
      vendorId: await addVendor(),
    });
    await query(
      "ssup",
      "update public.marketing_expenses set remarks = 'Paid' where id = $1",
      [expense],
    );
    const rows = await query<{ created_by: string; updated_by: string }>(
      "md",
      "select created_by, updated_by from public.marketing_expenses where id = $1",
      [expense],
    );
    expect(rows).toEqual([
      { created_by: t.profileIds.marketing, updated_by: t.profileIds.ssup },
    ]);
  });
});

describe("events", () => {
  it("totals a cost line as rate times qty, and an event in use cannot be deleted", async () => {
    const [event] = await query<{ id: string }>(
      "marketing",
      "insert into public.marketing_events (name, budget) values ('Archidex 2027', 20000) returning id",
    );
    const [cost] = await query<{ total: string }>(
      "marketing",
      `insert into public.marketing_event_costs (event_id, cost_group, rate, qty)
       values ($1, 'Booth', 1234.56, 3) returning total`,
      [event.id],
    );
    expect(cost.total).toBe("3703.68");
    await expect(
      deleteFrom("md", "marketing_events", event.id),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("prepaid accounts", () => {
  it("works out the balance from the entries and flags a low one", async () => {
    const vendorId = await addVendor("marketing", "Europe designer");
    const entry = (kind: string, amount: number, extra = "") =>
      query(
        "marketing",
        `insert into public.marketing_prepaid_entries
           (vendor_id, kind, description, amount_rm ${extra ? ", marketing_foc" : ""})
         values ($1, $2, 'Hotel Seri - lobby', $3 ${extra ? ", true" : ""})`,
        [vendorId, kind, amount],
      );
    await entry("top_up", 5000);
    await entry("deduction", 3000);
    await entry("deduction", 1200.5, "foc");
    await query(
      "marketing",
      "update public.marketing_vendors set low_balance_alert = 1000 where id = $1",
      [vendorId],
    );
    const rows = await query(
      "accounts",
      `select topped_up, used, balance, jobs, marketing_foc, low
       from public.marketing_prepaid_balances where vendor_id = $1`,
      [vendorId],
    );
    expect(rows).toEqual([
      {
        topped_up: "5000.00",
        used: "4200.50",
        balance: "799.50",
        jobs: 2,
        marketing_foc: "1200.50",
        low: true,
      },
    ]);
  });

  it("a deduction needs the client and project; F.O.C is for deductions only", async () => {
    const vendorId = await addVendor();
    await expect(
      query(
        "marketing",
        `insert into public.marketing_prepaid_entries (vendor_id, kind, amount_rm)
         values ($1, 'deduction', 100)`,
        [vendorId],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      query(
        "marketing",
        `insert into public.marketing_prepaid_entries (vendor_id, kind, amount_rm, marketing_foc)
         values ($1, 'top_up', 100, true)`,
        [vendorId],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("give-aways", () => {
  it("totals qty times unit cost", async () => {
    const [row] = await query<{ total: string }>(
      "marketing",
      `insert into public.marketing_giveaways (item, given_to, qty, unit_cost)
       values ('Wallpaper book', 'Hotel Seri', 3, 85.5) returning total`,
    );
    expect(row.total).toBe("256.50");
  });
});

describe("who reads and writes", () => {
  const TABLES = [
    "marketing_categories",
    "marketing_vendors",
    "marketing_events",
    "marketing_event_costs",
    "marketing_expenses",
    "marketing_prepaid_entries",
    "marketing_giveaways",
    "marketing_prepaid_balances",
  ];

  const count = async (as: JobRole, table: string) =>
    (
      await query<{ n: number }>(
        as,
        `select count(*)::int as n from public.${table}`,
      )
    )[0].n;

  it.each([...EDITORS, "accounts"] as const)(
    "%s reads every table",
    async (who) => {
      for (const table of TABLES)
        expect(await count(who, table)).toBeGreaterThan(0);
    },
  );

  it.each(OUTSIDERS)("%s reads nothing and cannot write", async (who) => {
    for (const table of TABLES) expect(await count(who, table)).toBe(0);
    await expect(addVendor(who)).rejects.toThrow(/row-level security/);
  });

  it.each(EDITORS)("%s adds, changes and deletes", async (who) => {
    const vendorId = await addVendor(who);
    const expense = await addExpense(who, { vendorId });
    expect(
      await query(
        who,
        "update public.marketing_expenses set remarks = 'Checked' where id = $1 returning id",
        [expense],
      ),
    ).toHaveLength(1);
    expect(await deleteFrom(who, "marketing_expenses", expense)).toHaveLength(
      1,
    );
    expect(await deleteFrom(who, "marketing_vendors", vendorId)).toHaveLength(
      1,
    );
  });

  it("HR & Accounts reads only", async () => {
    const vendorId = await addVendor();
    const expense = await addExpense("marketing", { vendorId });
    await expect(addVendor("accounts")).rejects.toThrow(/row-level security/);
    expect(
      await query(
        "accounts",
        "update public.marketing_expenses set remarks = 'x' where id = $1 returning id",
        [expense],
      ),
    ).toEqual([]);
    expect(await deleteFrom("accounts", "marketing_expenses", expense)).toEqual(
      [],
    );
  });

  it("a person who left reads nothing", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.marketing],
    );
    expect(await count("marketing", "marketing_expenses")).toBe(0);
    await t.actAs(null);
    await t.db.query("update public.profiles set active = true where id = $1", [
      t.profileIds.marketing,
    ]);
  });
});
