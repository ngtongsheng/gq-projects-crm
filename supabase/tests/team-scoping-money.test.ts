import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { malaysiaDate } from "./fixtures";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 11 D6: Eddie (director) and Vanessa (bd) each read only their own team's MOFs, payments,
// commission and monthly sales reports. The MD and HR & Accounts read all; Purchasing keeps every
// payment; the operational roles keep every MOF.

type Records = {
  mofId: string;
  totalChangeId: string;
  paymentId: string;
  payoutId: string;
  reportId: string;
};
type Table =
  | "mofs"
  | "mof_total_changes"
  | "payments"
  | "commission_payouts"
  | "monthly_reports";

let t: TestDatabase;
let beeId: string;
let eddieTeam: Records;
let vanessaTeam: Records;
let siteReportId: string;
let n = 0;

async function asService<T>(sql: string, params: unknown[]) {
  await t.actAs(null);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

/** An order sold by one salesperson, paid in full, with a commission payout and a sales report. */
async function addMoneyRecords(salespersonId: string): Promise<Records> {
  n += 1;
  const today = await malaysiaDate(t);
  const [mof] = await asService<{ id: string }>(
    `insert into public.mofs (mof_no, loa_date, salesperson_id, company_name, project_name, contract_sum)
     values ($1, $2, $3, 'Team Co', 'Team Project', 1000) returning id`,
    [`TEAM-${n}`, today, salespersonId],
  );
  await asService(
    "insert into public.mof_costs (mof_id, cost) values ($1, 500)",
    [mof.id],
  );
  const [totalChange] = await asService<{ id: string }>(
    `insert into public.mof_total_changes (mof_id, old_total, new_total, reason)
     values ($1, 900, 1000, 'Variation') returning id`,
    [mof.id],
  );
  const [payment] = await asService<{ id: string }>(
    "insert into public.payments (mof_id, amount, received_on) values ($1, 1000, $2) returning id",
    [mof.id, today],
  );
  const [payout] = await asService<{ id: string }>(
    `insert into public.commission_payouts (mof_id, profile_id, amount, paid_on)
     values ($1, $2, 1, $3) returning id`,
    [mof.id, salespersonId, today],
  );
  const [report] = await asService<{ id: string }>(
    `insert into public.monthly_reports (profile_id, month, kind)
     values ($1, date_trunc('month', now())::date, 'sales') returning id`,
    [salespersonId],
  );
  return {
    mofId: mof.id,
    totalChangeId: totalChange.id,
    paymentId: payment.id,
    payoutId: payout.id,
    reportId: report.id,
  };
}

async function actAs(who: JobRole | string) {
  if (t.profileIds[who as JobRole]) {
    await t.actAs(who as JobRole);
    return;
  }
  await t.db.query("select set_config('request.jwt.claim.sub', $1, false)", [
    who,
  ]);
  await t.db.exec("set role authenticated");
}

async function visible(who: JobRole | string, table: Table) {
  await actAs(who);
  const { rows } = await t.db.query<{ id: string }>(
    `select id from public.${table}`,
  );
  return rows.map((row) => row.id);
}

async function commissionOrders(who: JobRole | string) {
  await actAs(who);
  const { rows } = await t.db.query<{ mof_id: string }>(
    "select mof_id from public.commission_basis()",
  );
  return rows.map((row) => row.mof_id);
}

async function reportFilers(who: JobRole | string) {
  await actAs(who);
  const { rows } = await t.db.query<{ id: string }>(
    "select id from public.report_filers()",
  );
  return rows.map((row) => row.id);
}

const idOf = (records: Records, table: Table) =>
  ({
    mofs: records.mofId,
    mof_total_changes: records.totalChangeId,
    payments: records.paymentId,
    commission_payouts: records.payoutId,
    monthly_reports: records.reportId,
  })[table];

const tables: Table[] = [
  "mofs",
  "mof_total_changes",
  "payments",
  "commission_payouts",
  "monthly_reports",
];

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
  eddieTeam = await addMoneyRecords(t.profileIds.sales);
  vanessaTeam = await addMoneyRecords(beeId);
  [{ id: siteReportId }] = await asService<{ id: string }>(
    `insert into public.monthly_reports (profile_id, month, kind)
     values ($1, date_trunc('month', now())::date, 'site') returning id`,
    [t.profileIds.site],
  );
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

  it("a salesperson reads only their own", async () => {
    const rows = await visible(beeId, table);
    if (table === "mofs" || table === "mof_total_changes") {
      // The register stays open to everyone; My Sales filters in the app.
      expect(rows).toContain(idOf(eddieTeam, table));
    } else {
      expect(rows).not.toContain(idOf(eddieTeam, table));
    }
    expect(rows).toContain(idOf(vanessaTeam, table));
  });
});

describe("operational reads stay", () => {
  it.each([
    "support",
    "site",
    "ssup",
  ] as const)("%s reads every MOF", async (jobRole) => {
    const rows = await visible(jobRole, "mofs");
    expect(rows).toContain(eddieTeam.mofId);
    expect(rows).toContain(vanessaTeam.mofId);
  });

  it("Purchasing reads every payment", async () => {
    const rows = await visible("support", "payments");
    expect(rows).toContain(eddieTeam.paymentId);
    expect(rows).toContain(vanessaTeam.paymentId);
  });

  it("the Sales Director still reads site supervisors' reports", async () => {
    expect(await visible("director", "monthly_reports")).toContain(
      siteReportId,
    );
  });

  it("a Marketing Director does not read site supervisors' reports", async () => {
    expect(await visible("bd", "monthly_reports")).not.toContain(siteReportId);
  });
});

describe("commission basis", () => {
  it("gives a director their team's orders only", async () => {
    expect(await commissionOrders("director")).toEqual([eddieTeam.mofId]);
  });

  it("gives a Marketing Director their team's orders only", async () => {
    expect(await commissionOrders("bd")).toEqual([vanessaTeam.mofId]);
  });

  it("gives the MD every order", async () => {
    expect(await commissionOrders("md")).toEqual(
      expect.arrayContaining([eddieTeam.mofId, vanessaTeam.mofId]),
    );
  });

  it("gives a salesperson the orders they are on", async () => {
    expect(await commissionOrders(beeId)).toEqual([vanessaTeam.mofId]);
  });
});

describe("report filers", () => {
  it("lists a director's team salespeople and every site supervisor", async () => {
    const ids = await reportFilers("director");
    expect(ids).toContain(t.profileIds.sales);
    expect(ids).toContain(t.profileIds.site);
    expect(ids).not.toContain(beeId);
    expect(ids).not.toContain(t.profileIds.bd);
  });

  it("lists a Marketing Director's team salespeople only", async () => {
    expect(await reportFilers("bd")).toEqual([beeId]);
  });

  it("lists everyone who files for the MD", async () => {
    expect(await reportFilers("md")).toEqual(
      expect.arrayContaining([
        t.profileIds.sales,
        beeId,
        t.profileIds.site,
        t.profileIds.bd,
      ]),
    );
  });

  it("lists nobody for a salesperson", async () => {
    expect(await reportFilers(beeId)).toEqual([]);
  });
});
