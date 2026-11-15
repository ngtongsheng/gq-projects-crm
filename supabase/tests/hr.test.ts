import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 16 task 01 (D1): HR data is read and written only by the MD and HR & Accounts. The
// admin role alone grants nothing, View as runs as the viewed person (so a staff view sees
// nothing), and a person who has left sees nothing.

let t: TestDatabase;

const HR_TABLES = [
  "hr_policy_documents",
  "hr_extra_rules",
  "sales_grades",
  "staff_hr_records",
  "staff_packages",
  "standard_packages",
  "outstation_rules",
] as const;

beforeAll(async () => {
  t = await createTestDatabase();
});

afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.actAs(null);
  await t.db.exec(`
    delete from public.staff_packages;
    delete from public.staff_hr_records;
    delete from public.hr_extra_rules;
    delete from public.hr_policy_documents;
  `);
  await t.db.query(
    "insert into public.hr_extra_rules (starts_on, rule, added_by) values ('2026-11-12', 'Claims cut-off is the 25th.', $1)",
    [t.profileIds.md],
  );
  await t.db.query(
    "insert into public.hr_policy_documents (category, title, version, effective_on, added_by) values ('employment', 'Handbook', '2026-09', '2026-09-08', $1)",
    [t.profileIds.md],
  );
  await t.db.query(
    "insert into public.staff_hr_records (profile_id, grade) values ($1, 'S1')",
    [t.profileIds.sales],
  );
  await t.db.query(
    "insert into public.staff_packages (profile_id, effective_on, basic, added_by) values ($1, '2026-01-01', 3000, $2)",
    [t.profileIds.sales, t.profileIds.md],
  );
  await t.db.query(
    "update public.profiles set active = true, left_on = null, role = case when job_role = 'md' then 'admin' else 'staff' end",
  );
});

async function visibleRows(table: string): Promise<number> {
  const { rows } = await t.db.query<{ n: number }>(
    `select count(*)::int as n from public.${table}`,
  );
  return rows[0].n;
}

describe("seed", () => {
  it("ships the demo's grades J1-M2 in order with no basic", async () => {
    const { rows } = await t.db.query<{
      grade: string;
      annual_target: string;
      basic: string | null;
    }>(
      "select grade, annual_target::text, basic::text from public.sales_grades order by position",
    );
    expect(rows.map((r) => r.grade)).toEqual([
      "J1",
      "J2",
      "J3",
      "S1",
      "S2",
      "S3",
      "SN1",
      "SN2",
      "SN3",
      "M1",
      "M2",
    ]);
    expect(rows[0]).toEqual({
      grade: "J1",
      annual_target: "960000.00",
      basic: null,
    });
    expect(rows[10].annual_target).toBe("3600000.00");
  });

  it("ships the demo's standard packages and outstation rates", async () => {
    const standard = await t.db.query<{ position: string; claim_cap: string }>(
      "select position, claim_cap::text from public.standard_packages order by position",
    );
    expect(standard.rows).toEqual([
      { position: "sales", claim_cap: "500.00" },
      { position: "site", claim_cap: "500.00" },
    ]);
    const { rows } = await t.db.query<Record<string, string>>(
      "select breakfast::text, lunch::text, dinner::text, hotel_staff::text, hotel_manager::text, hotel_director::text from public.outstation_rules",
    );
    expect(rows).toEqual([
      {
        breakfast: "10.00",
        lunch: "15.00",
        dinner: "25.00",
        hotel_staff: "100.00",
        hotel_manager: "150.00",
        hotel_director: "180.00",
      },
    ]);
  });
});

describe("md and accounts", () => {
  it.each([
    "md",
    "accounts",
  ] as const)("lets %s read every HR table", async (jobRole) => {
    await t.actAs(jobRole);
    for (const table of HR_TABLES) {
      expect(await visibleRows(table), table).toBeGreaterThan(0);
    }
  });

  it.each([
    "md",
    "accounts",
  ] as const)("lets %s write HR data", async (jobRole) => {
    await t.actAs(jobRole);
    const me = t.profileIds[jobRole];
    await t.db.query(
      "insert into public.hr_policy_documents (category, title, version, effective_on, link) values ('leave', 'Leave policy', 'v2', '2027-01-01', 'https://drive.google.com/x')",
    );
    await t.db.query(
      "update public.hr_policy_documents set note = 'Edited' where title = 'Handbook'",
    );
    await t.db.query(
      "insert into public.hr_extra_rules (starts_on, rule) values ('2027-01-01', 'New rule.')",
    );
    await t.db.query(
      "delete from public.hr_extra_rules where rule = 'New rule.'",
    );
    await t.db.query(
      "insert into public.staff_packages (profile_id, effective_on, basic, allowances, claim_cap, hotel_level, reason) values ($1, '2027-01-01', 3300, '[{\"name\": \"car\", \"amount\": 300}]', 600, 'manager', 'Annual increment')",
      [t.profileIds.sales],
    );
    await t.db.query(
      "insert into public.staff_hr_records (profile_id, grade, appendix_signed_on, appendix_version) values ($1, 'J1', '2026-09-10', '2026-09-08')",
      [t.profileIds.site],
    );
    await t.db.query(
      "update public.sales_grades set basic = 2500 where grade = 'J1'",
    );
    await t.db.query(
      "update public.standard_packages set claim_cap = 700 where position = 'sales'",
    );
    await t.db.query("update public.outstation_rules set lunch = 20");

    const { rows } = await t.db.query<{ added_by: string }>(
      "select added_by from public.staff_packages where effective_on = '2027-01-01'",
    );
    expect(rows).toEqual([{ added_by: me }]);
    const lunch = await t.db.query<{ lunch: string }>(
      "select lunch::text from public.outstation_rules",
    );
    expect(lunch.rows[0].lunch).toBe("20.00");
  });

  it("keeps package history: a change is a new row, never an edit", async () => {
    await t.actAs("accounts");
    const update = await t.db.query(
      "update public.staff_packages set basic = 9999 returning 1",
    );
    expect(update.rows).toHaveLength(0);
    const remove = await t.db.query(
      "delete from public.staff_packages returning 1",
    );
    expect(remove.rows).toHaveLength(0);
    await expect(
      t.db.query(
        "insert into public.staff_packages (profile_id, effective_on, basic) values ($1, '2026-01-01', 3500)",
        [t.profileIds.sales],
      ),
    ).rejects.toThrow(/unique/);
  });

  it("records who added a row and refuses another name", async () => {
    await t.actAs("accounts");
    await expect(
      t.db.query(
        "insert into public.hr_extra_rules (starts_on, rule, added_by) values ('2027-01-01', 'x', $1)",
        [t.profileIds.md],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("everyone else", () => {
  const cases = [
    ["an admin who is not the MD or accounts", "support"],
    ["the Sales Director", "director"],
    ["a salesperson (also what View as shows)", "sales"],
    ["a site supervisor", "site"],
  ] as const;

  it.each(
    cases,
  )("shows %s nothing and refuses their writes", async (_, jobRole) => {
    if (jobRole === "support") {
      await t.db.query(
        "update public.profiles set role = 'admin' where id = $1",
        [t.profileIds.support],
      );
    }
    await t.actAs(jobRole);
    for (const table of HR_TABLES) {
      expect(await visibleRows(table), table).toBe(0);
    }
    await expect(
      t.db.query(
        "insert into public.staff_packages (profile_id, effective_on, basic) values ($1, '2027-01-01', 9999)",
        [t.profileIds[jobRole]],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      t.db.query(
        "insert into public.hr_extra_rules (starts_on, rule) values ('2027-01-01', 'x')",
      ),
    ).rejects.toThrow(/row-level security/);
    const update = await t.db.query(
      "update public.sales_grades set basic = 1 returning 1",
    );
    expect(update.rows).toHaveLength(0);
  });

  it("shows HR & Accounts nothing once they have left", async () => {
    await t.db.query(
      "update public.profiles set active = false, left_on = current_date where id = $1",
      [t.profileIds.accounts],
    );
    await t.actAs("accounts");
    for (const table of HR_TABLES) {
      expect(await visibleRows(table), table).toBe(0);
    }
    await expect(
      t.db.query(
        "insert into public.hr_extra_rules (starts_on, rule) values ('2027-01-01', 'x')",
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("checks", () => {
  it.each([
    ['[{"name": "car", "amount": 0}]', "a zero amount"],
    ['[{"name": "car", "amount": "300"}]', "an amount as text"],
    ['[{"name": "yacht", "amount": 300}]', "an unknown allowance"],
    ['[{"name": "car", "amount": 300, "x": 1}]', "an extra field"],
    ['{"name": "car", "amount": 300}', "an object, not a list"],
  ])("refuses allowances %s (%s)", async (allowances) => {
    await t.actAs("accounts");
    await expect(
      t.db.query(
        "insert into public.staff_packages (profile_id, effective_on, basic, allowances) values ($1, '2027-02-01', 3000, $2)",
        [t.profileIds.sales, allowances],
      ),
    ).rejects.toThrow(/check/);
  });

  it("refuses a document with both a file and a link", async () => {
    await t.actAs("md");
    await expect(
      t.db.query(`
        insert into public.hr_policy_documents
          (id, category, title, version, effective_on, link, file_path, file_name, file_content_type, file_uploaded_at)
        values
          ('00000000-0000-4000-8000-000000000001', 'leave', 'x', 'v1', '2027-01-01', 'https://x.test',
           'hr-policies/00000000-0000-4000-8000-000000000001/a.pdf', 'a.pdf', 'application/pdf', now())
      `),
    ).rejects.toThrow(/check/);
  });

  it("lets one document replace another only once", async () => {
    await t.actAs("md");
    const { rows } = await t.db.query<{ id: string }>(
      "select id from public.hr_policy_documents where title = 'Handbook'",
    );
    const insert =
      "insert into public.hr_policy_documents (category, title, version, effective_on, replaces_id) values ('employment', 'Handbook', $1, '2027-01-01', $2)";
    await t.db.query(insert, ["2027-01", rows[0].id]);
    await expect(t.db.query(insert, ["2027-02", rows[0].id])).rejects.toThrow(
      /unique/,
    );
  });
});
