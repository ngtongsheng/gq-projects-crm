import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 16 D3: per-year targets. The backfill keeps every current profiles.yearly_target, and
// triggers keep it equal to this year's effective target (own row, else grade) so loop 14
// Performance reads the same numbers.

const MIGRATION = "20261116110000_yearly_targets.sql";

async function currentYear(t: TestDatabase): Promise<number> {
  const { rows } = await t.db.query<{ year: number }>(
    "select extract(year from now() at time zone 'Asia/Kuala_Lumpur')::int as year",
  );
  return rows[0].year;
}

async function yearlyTarget(
  t: TestDatabase,
  profileId: string,
): Promise<string | null> {
  const { rows } = await t.db.query<{ target: string | null }>(
    "select yearly_target::text as target from public.profiles where id = $1",
    [profileId],
  );
  return rows[0].target;
}

describe("backfill", () => {
  it("keeps every current target and adds a row for this year per target", async () => {
    const t = await createTestDatabase({ migrationsBefore: MIGRATION });
    try {
      const { sales, bd, director, support } = t.profileIds;
      await t.db.query(
        "update public.profiles set yearly_target = $2 where id = $1",
        [sales, 1_250_000.5],
      );
      await t.db.query(
        "update public.profiles set yearly_target = 0 where id = $1",
        [bd],
      );
      // A grade but no target: the backfill must not give them one.
      await t.db.query(
        "insert into public.staff_hr_records (profile_id, grade) values ($1, 'S1'), ($2, 'J1')",
        [support, sales],
      );
      const { rows: before } = await t.db.query<{
        id: string;
        target: string | null;
      }>("select id, yearly_target::text as target from public.profiles");

      await applyMigrations(t.db, { from: MIGRATION });

      const { rows: after } = await t.db.query<{
        id: string;
        target: string | null;
      }>("select id, yearly_target::text as target from public.profiles");
      expect(after).toEqual(expect.arrayContaining(before));
      expect(after).toHaveLength(before.length);
      expect(await yearlyTarget(t, support)).toBeNull();
      expect(await yearlyTarget(t, director)).toBeNull();

      const { rows } = await t.db.query<{
        profile_id: string;
        year: number;
        sales_target: string;
        visit_target: number | null;
      }>(
        "select profile_id, year, sales_target::text, visit_target from public.yearly_targets order by sales_target",
      );
      const year = await currentYear(t);
      expect(rows).toEqual([
        { profile_id: bd, year, sales_target: "0.00", visit_target: null },
        {
          profile_id: sales,
          year,
          sales_target: "1250000.50",
          visit_target: null,
        },
      ]);
    } finally {
      await t.close();
    }
  });
});

describe("keeping yearly_target in step", () => {
  let t: TestDatabase;
  let year: number;

  beforeAll(async () => {
    t = await createTestDatabase();
    year = await currentYear(t);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.actAs(null);
    await t.db.exec(`
      delete from public.yearly_targets;
      delete from public.staff_hr_records;
      update public.sales_grades set annual_target = 1440000 where grade = 'S1';
      update public.sales_grades set annual_target = 1800000 where grade = 'S2';
      update public.profiles set yearly_target = null, active = true, left_on = null;
    `);
  });

  it("follows the person's own row on insert, update and delete", async () => {
    const { sales } = t.profileIds;
    await t.db.query(
      "insert into public.yearly_targets (profile_id, year, sales_target) values ($1, $2, 1500000)",
      [sales, year],
    );
    expect(await yearlyTarget(t, sales)).toBe("1500000.00");

    await t.db.query(
      "update public.yearly_targets set sales_target = 1600000 where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBe("1600000.00");

    await t.db.query(
      "delete from public.yearly_targets where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBeNull();
  });

  it("falls back to the grade without a row, with an empty sales target, or after delete", async () => {
    const { sales } = t.profileIds;
    await t.db.query(
      "insert into public.staff_hr_records (profile_id, grade) values ($1, 'S1')",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBe("1440000.00");

    await t.db.query(
      "insert into public.yearly_targets (profile_id, year, visit_target) values ($1, $2, 120)",
      [sales, year],
    );
    expect(await yearlyTarget(t, sales)).toBe("1440000.00");

    await t.db.query(
      "update public.yearly_targets set sales_target = 2000000 where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBe("2000000.00");

    await t.db.query(
      "delete from public.yearly_targets where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBe("1440000.00");
  });

  it("follows a grade change, a grade's new annual target, and a grade removed", async () => {
    const { sales } = t.profileIds;
    await t.db.query(
      "insert into public.staff_hr_records (profile_id, grade) values ($1, 'S1')",
      [sales],
    );
    await t.db.query(
      "update public.staff_hr_records set grade = 'S2' where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBe("1800000.00");

    await t.db.query(
      "update public.sales_grades set annual_target = 1900000 where grade = 'S2'",
    );
    expect(await yearlyTarget(t, sales)).toBe("1900000.00");

    await t.db.query(
      "update public.staff_hr_records set grade = null where profile_id = $1",
      [sales],
    );
    expect(await yearlyTarget(t, sales)).toBeNull();
  });

  it("keeps the person's own row over a grade change", async () => {
    const { sales } = t.profileIds;
    await t.db.query(
      "insert into public.yearly_targets (profile_id, year, sales_target) values ($1, $2, 1500000)",
      [sales, year],
    );
    await t.db.query(
      "insert into public.staff_hr_records (profile_id, grade) values ($1, 'S2')",
      [sales],
    );
    await t.db.query(
      "update public.sales_grades set annual_target = 1900000 where grade = 'S2'",
    );
    expect(await yearlyTarget(t, sales)).toBe("1500000.00");
  });

  it("ignores other years' rows", async () => {
    const { sales } = t.profileIds;
    await t.db.query(
      "insert into public.yearly_targets (profile_id, year, sales_target) values ($1, $2, 900000), ($1, $3, 2500000)",
      [sales, year - 1, year + 1],
    );
    expect(await yearlyTarget(t, sales)).toBeNull();
  });
});

describe("who reads and writes", () => {
  let t: TestDatabase;
  let year: number;

  beforeAll(async () => {
    t = await createTestDatabase();
    year = await currentYear(t);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await t.actAs(null);
    await t.db.exec("delete from public.yearly_targets");
    await t.db.query(
      "update public.profiles set active = true, left_on = null, reports_to = case when id = $1 then $2::uuid end",
      [t.profileIds.sales, t.profileIds.bd],
    );
    for (const id of [t.profileIds.sales, t.profileIds.site]) {
      await t.db.query(
        "insert into public.yearly_targets (profile_id, year, sales_target, visit_target) values ($1, $2, 1000000, 100)",
        [id, year],
      );
    }
  });

  async function visibleTargets(): Promise<string[]> {
    const { rows } = await t.db.query<{ profile_id: string }>(
      "select profile_id from public.yearly_targets",
    );
    return rows.map((r) => r.profile_id).sort();
  }

  it.each([
    "md",
    "director",
    "accounts",
  ] as const)("lets %s read and set anyone's targets, which updates yearly_target", async (jobRole) => {
    await t.actAs(jobRole);
    expect(await visibleTargets()).toEqual(
      [t.profileIds.sales, t.profileIds.site].sort(),
    );
    await t.db.query(
      "insert into public.yearly_targets (profile_id, year, sales_target) values ($1, $2, 1200000)",
      [t.profileIds.support, year],
    );
    await t.db.query(
      "update public.yearly_targets set sales_target = 1100000 where profile_id = $1",
      [t.profileIds.sales],
    );
    await t.db.query(
      "delete from public.yearly_targets where profile_id = $1",
      [t.profileIds.site],
    );
    await t.actAs(null);
    expect(await yearlyTarget(t, t.profileIds.support)).toBe("1200000.00");
    expect(await yearlyTarget(t, t.profileIds.sales)).toBe("1100000.00");
    expect(await yearlyTarget(t, t.profileIds.site)).toBeNull();
  });

  it("lets a person read only their own targets", async () => {
    await t.actAs("sales");
    expect(await visibleTargets()).toEqual([t.profileIds.sales]);
    await t.actAs("support");
    expect(await visibleTargets()).toEqual([]);
  });

  it("lets a team lead read their team's targets", async () => {
    await t.actAs("bd");
    expect(await visibleTargets()).toEqual([t.profileIds.sales]);
  });

  it.each([
    "sales",
    "bd",
    "site",
  ] as const)("does not let %s set targets", async (jobRole) => {
    await t.actAs(jobRole);
    await expect(
      t.db.query(
        "insert into public.yearly_targets (profile_id, year, sales_target) values ($1, $2, 1)",
        [t.profileIds[jobRole], year + 1],
      ),
    ).rejects.toThrow(/row-level security/);
    const { affectedRows } = await t.db.query(
      "update public.yearly_targets set sales_target = 1 where profile_id = $1",
      [t.profileIds[jobRole]],
    );
    expect(affectedRows).toBe(0);
  });

  it("shows nothing to a person who has left", async () => {
    await t.db.query(
      "update public.profiles set active = false, left_on = '2026-10-31' where id = $1",
      [t.profileIds.sales],
    );
    await t.actAs("sales");
    expect(await visibleTargets()).toEqual([]);
  });

  it("keeps the grade table and the resolver hidden from staff", async () => {
    await t.actAs("sales");
    await expect(
      t.db.query("select public.effective_sales_target($1, $2::smallint)", [
        t.profileIds.sales,
        year,
      ]),
    ).rejects.toThrow(/permission denied/);
  });
});
