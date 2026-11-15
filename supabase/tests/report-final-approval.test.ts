import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import {
  applyMigrations,
  createTestDatabase,
  type TestDatabase,
} from "./harness";

// Loop 14 D6: the team lead or the MD reviews a monthly report, then the MD gives the final
// approval (her own review counts as both). The BD Director's report goes to the MD only.
// Reports reviewed before the change count as approved.

const MIGRATION = "20261115190000_report_final_approval.sql";

type Row = {
  status: string;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

let t: TestDatabase;
let monthsAgo = 0;

/** A submitted report by `filer`, in a month of its own. */
async function submitted(filer: JobRole, kind = filer): Promise<string> {
  monthsAgo += 1;
  await t.actAs(null);
  const { rows } = await t.db.query<{ id: string }>(
    `insert into public.monthly_reports (profile_id, month, kind, status, stats, submitted_at)
     values ($1, date_trunc('month', now())::date - make_interval(months => $2::int), $3,
       'submitted', '{}'::jsonb, now())
     returning id`,
    [t.profileIds[filer], monthsAgo, kind],
  );
  return rows[0].id;
}

async function setStatus(as: JobRole, reportId: string, status: string) {
  await t.actAs(as);
  const { rows } = await t.db.query<Row>(
    `update public.monthly_reports set status = $2 where id = $1
     returning status, reviewed_by, approved_by, approved_at`,
    [reportId, status],
  );
  return rows;
}

beforeAll(async () => {
  t = await createTestDatabase();
  await t.db.query("update public.profiles set reports_to = $1 where id = $2", [
    t.profileIds.director,
    t.profileIds.sales,
  ]);
});

afterAll(async () => {
  await t.close();
});

describe("first step: team lead or MD reviews", () => {
  it("refuses a lead outside the salesperson's team", async () => {
    const report = await submitted("sales");
    expect(await setStatus("bd", report, "reviewed")).toEqual([]);
  });

  it("lets the salesperson's own lead review, waiting for the MD", async () => {
    const report = await submitted("sales");
    expect(await setStatus("director", report, "reviewed")).toEqual([
      {
        status: "reviewed",
        reviewed_by: t.profileIds.director,
        approved_by: null,
        approved_at: null,
      },
    ]);
  });

  it("lets the Sales Director review a Site Supervisor's report", async () => {
    const report = await submitted("site");
    expect((await setStatus("director", report, "reviewed"))[0]?.status).toBe(
      "reviewed",
    );
  });

  it("makes the MD's review the final approval", async () => {
    const report = await submitted("sales");
    expect(await setStatus("md", report, "reviewed")).toEqual([
      expect.objectContaining({
        status: "approved",
        reviewed_by: t.profileIds.md,
        approved_by: t.profileIds.md,
      }),
    ]);
  });
});

describe("final approval", () => {
  it("comes only after a review", async () => {
    const report = await submitted("sales");
    await expect(setStatus("director", report, "approved")).rejects.toThrow(
      "Only the MD gives the final approval.",
    );

    await t.actAs("sales");
    const { rows } = await t.db.query<{ id: string }>(
      `insert into public.monthly_reports (month, highlights)
       values (date_trunc('month', now())::date - interval '10 years', '[]') returning id`,
    );
    await expect(setStatus("sales", rows[0].id, "approved")).rejects.toThrow(
      "Submit the report before it is reviewed.",
    );
  });

  it("is given by the MD only, once reviewed", async () => {
    const report = await submitted("sales");
    await setStatus("director", report, "reviewed");
    expect(await setStatus("director", report, "approved")).toEqual([]);
    expect(await setStatus("md", report, "approved")).toEqual([
      expect.objectContaining({
        status: "approved",
        reviewed_by: t.profileIds.director,
        approved_by: t.profileIds.md,
      }),
    ]);
    await expect(setStatus("md", report, "reviewed")).resolves.toEqual([]);
  });
});

describe("BD Director's report", () => {
  it("skips the lead step and goes to the MD only", async () => {
    const report = await submitted("bd");
    expect(await setStatus("director", report, "reviewed")).toEqual([]);
    expect(await setStatus("md", report, "reviewed")).toEqual([
      expect.objectContaining({
        status: "approved",
        reviewed_by: t.profileIds.md,
        approved_by: t.profileIds.md,
      }),
    ]);
  });
});

describe("who a report goes to", () => {
  it("names the salesperson's lead and the MD", async () => {
    await t.actAs("sales");
    const { rows } = await t.db.query<{ full_name: string; step: string }>(
      "select full_name, step from public.my_monthly_report_reviewers() order by step",
    );
    expect(rows).toEqual([
      { full_name: "Test md", step: "approve" },
      { full_name: "Test director", step: "review" },
    ]);
  });

  it("names only the MD for the BD Director", async () => {
    await t.actAs("bd");
    const { rows } = await t.db.query<{ step: string }>(
      "select step from public.my_monthly_report_reviewers()",
    );
    expect(rows).toEqual([{ step: "approve" }]);
  });
});

describe("backfill", () => {
  it("counts reports reviewed before the change as approved", async () => {
    const db = await createTestDatabase({ migrationsBefore: MIGRATION });
    try {
      await db.db.query(
        `insert into public.monthly_reports
           (profile_id, month, kind, status, stats, submitted_at, reviewed_by, reviewed_at)
         values ($1, '2026-09-01', 'sales', 'reviewed', '{}'::jsonb, now(), $2, '2026-10-05T03:00Z'),
           ($3, '2026-09-01', 'site', 'submitted', '{}'::jsonb, now(), null, null)`,
        [db.profileIds.sales, db.profileIds.director, db.profileIds.site],
      );
      await applyMigrations(db.db, { from: MIGRATION });
      const { rows } = await db.db.query<{
        kind: string;
        status: string;
        approved_by: string | null;
        approved_at: Date | null;
      }>(
        "select kind, status, approved_by, approved_at from public.monthly_reports order by kind",
      );
      expect(rows).toEqual([
        {
          kind: "sales",
          status: "approved",
          approved_by: db.profileIds.director,
          approved_at: new Date("2026-10-05T03:00Z"),
        },
        {
          kind: "site",
          status: "submitted",
          approved_by: null,
          approved_at: null,
        },
      ]);
    } finally {
      await db.close();
    }
  });
});
