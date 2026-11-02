import { z } from "zod";
import { shiftMonth } from "@/lib/domain/calendar-grid";
import {
  bdStats,
  REPORT_KINDS,
  REPORT_STATUSES,
  type ReportKind,
  ReportStats,
  ReportTargets,
  salesStats,
  siteStats,
} from "@/lib/domain/report-stats";
import { isClockTime } from "@/lib/format/clock-time";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

const VISIT_TYPES = ["visit", "site_visit", "walk_in"];

export const Highlight = z.object({
  company: z.string(),
  achievement: z.string(),
});
export type Highlight = z.infer<typeof Highlight>;

export type ReportSettings = { dueTime: string; targets: ReportTargets };

export type MonthlyReport = {
  id: string;
  profileId: string;
  month: CalendarDate;
  kind: ReportKind;
  status: (typeof REPORT_STATUSES)[number];
  stats: ReportStats | null;
  highlights: Highlight[];
  nextMonthPlan: string | null;
  supportNeeded: string | null;
  passDownsConfirmed: boolean;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

const REPORT_COLUMNS =
  "id, profile_id, month, kind, status, stats, highlights, next_month_plan, support_needed, pass_downs_confirmed, submitted_at, reviewed_by, review_note";

const reportRow = z
  .object({
    id: z.string(),
    profile_id: z.string(),
    month: z.string(),
    kind: z.enum(REPORT_KINDS),
    status: z.enum(REPORT_STATUSES),
    stats: ReportStats.nullable(),
    highlights: z.array(Highlight),
    next_month_plan: z.string().nullable(),
    support_needed: z.string().nullable(),
    pass_downs_confirmed: z.boolean(),
    submitted_at: z.string().nullable(),
    reviewed_by: z.string().nullable(),
    review_note: z.string().nullable(),
  })
  .transform(
    (row): MonthlyReport => ({
      id: row.id,
      profileId: row.profile_id,
      month: row.month,
      kind: row.kind,
      status: row.status,
      stats: row.stats,
      highlights: row.highlights,
      nextMonthPlan: row.next_month_plan,
      supportNeeded: row.support_needed,
      passDownsConfirmed: row.pass_downs_confirmed,
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      reviewedBy: row.reviewed_by,
      reviewNote: row.review_note,
    }),
  );

const DEFAULT_DUE_TIME = "09:00";
const dueTimeSetting = z.string().refine(isClockTime).catch(DEFAULT_DUE_TIME);

export async function loadReportSettings(): Promise<ReportSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["report_due_time", "report_targets"]);
  if (error)
    throw new Error(`Could not load report settings: ${error.message}`);
  const rows = z
    .array(z.object({ key: z.string(), value: z.unknown() }))
    .parse(data);
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  return {
    dueTime: dueTimeSetting.parse(value("report_due_time")),
    targets: ReportTargets.parse(value("report_targets") ?? {}),
  };
}

/** One person's report for a month, or null when not started or not visible to the caller. */
export async function loadMonthlyReport(
  profileId: string,
  month: CalendarDate,
): Promise<MonthlyReport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select(REPORT_COLUMNS)
    .eq("profile_id", profileId)
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(`Could not load the report: ${error.message}`);
  return data ? reportRow.parse(data) : null;
}

/** Every report for a month the caller may read (RLS limits it). */
export async function loadMonthReports(
  month: CalendarDate,
): Promise<MonthlyReport[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select(REPORT_COLUMNS)
    .eq("month", month);
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return z.array(reportRow).parse(data);
}

/** Malaysia midnight at the start of the month and of the next, for timestamp columns. */
function monthBounds(month: CalendarDate) {
  return {
    from: `${month}T00:00:00+08:00`,
    to: `${shiftMonth(month, 1)}T00:00:00+08:00`,
  };
}

const visitRows = z.array(
  z.object({
    contact_id: z.string(),
    owner_id: z.string(),
    starts_at: z.string(),
  }),
);

const projectRows = z.array(
  z.object({ pic_id: z.string(), stage: z.string(), created_at: z.string() }),
);

const orderRows = z.array(
  z.object({
    salesperson_id: z.string(),
    loa_date: z.string(),
    contract_sum: z.coerce.number(),
    vo_amount: z.coerce.number(),
    projects: z.object({ passed_by: z.string().nullable() }).nullable(),
  }),
);

async function loadSalesStats(
  kind: "sales" | "bd",
  personId: string,
  month: CalendarDate,
  targets: ReportTargets,
): Promise<ReportStats> {
  const supabase = await createClient();
  const { from, to } = monthBounds(month);

  const mine = await supabase
    .from("activities")
    .select("contact_id")
    .eq("owner_id", personId)
    .eq("status", "completed")
    .in("type", VISIT_TYPES)
    .gte("starts_at", from)
    .lt("starts_at", to);
  if (mine.error)
    throw new Error(`Could not load visits: ${mine.error.message}`);
  const contactIds = [
    ...new Set(
      z
        .array(z.object({ contact_id: z.string() }))
        .parse(mine.data)
        .map((row) => row.contact_id),
    ),
  ];

  // Earlier visits to the same contacts decide who met them first.
  const [visits, projects, orders] = await Promise.all([
    contactIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("activities")
          .select("contact_id, owner_id, starts_at")
          .in("contact_id", contactIds)
          .eq("status", "completed")
          .in("type", VISIT_TYPES)
          .lt("starts_at", to),
    supabase
      .from("projects")
      .select("pic_id, stage, created_at")
      .eq("pic_id", personId)
      .gte("created_at", from)
      .lt("created_at", to),
    supabase
      .from("mofs")
      .select(
        "salesperson_id, loa_date, contract_sum, vo_amount, projects(passed_by)",
      )
      .gte("loa_date", month)
      .lt("loa_date", shiftMonth(month, 1)),
  ]);
  for (const result of [visits, projects, orders]) {
    if (result.error) {
      throw new Error(`Could not load report figures: ${result.error.message}`);
    }
  }

  const input = {
    personId,
    month,
    targets,
    visits: visitRows.parse(visits.data).map((row) => ({
      contactId: row.contact_id,
      ownerId: row.owner_id,
      day: todayMyt(new Date(row.starts_at)),
    })),
    projects: projectRows.parse(projects.data).map((row) => ({
      picId: row.pic_id,
      stage: row.stage,
      createdOn: todayMyt(new Date(row.created_at)),
    })),
    orders: orderRows.parse(orders.data).map((row) => ({
      salespersonId: row.salesperson_id,
      passedBy: row.projects?.passed_by ?? null,
      loaDate: row.loa_date,
      contractSum: row.contract_sum,
      voAmount: row.vo_amount,
    })),
  };
  return kind === "bd" ? bdStats(input) : salesStats(input);
}

const siteLogRows = z.array(
  z.object({
    supervisor_id: z.string(),
    mof_id: z.string(),
    visited_on: z.string(),
    activity: z.string(),
    handover_signed: z.boolean(),
  }),
);

const otRows = z.array(
  z.object({
    profile_id: z.string(),
    work_date: z.string(),
    hours: z.coerce.number(),
    status: z.string(),
  }),
);

async function loadSiteStats(
  personId: string,
  month: CalendarDate,
  targets: ReportTargets,
): Promise<ReportStats> {
  const supabase = await createClient();
  const next = shiftMonth(month, 1);
  const [logs, claims] = await Promise.all([
    supabase
      .from("site_logs")
      .select("supervisor_id, mof_id, visited_on, activity, handover_signed")
      .eq("supervisor_id", personId)
      .gte("visited_on", month)
      .lt("visited_on", next),
    supabase
      .from("ot_claims")
      .select("profile_id, work_date, hours, status")
      .eq("profile_id", personId)
      .gte("work_date", month)
      .lt("work_date", next),
  ]);
  if (logs.error)
    throw new Error(`Could not load site log: ${logs.error.message}`);
  if (claims.error) {
    throw new Error(`Could not load overtime: ${claims.error.message}`);
  }

  return siteStats({
    personId,
    month,
    targets,
    siteLogs: siteLogRows.parse(logs.data).map((row) => ({
      supervisorId: row.supervisor_id,
      mofId: row.mof_id,
      visitedOn: row.visited_on,
      activity: row.activity,
      handoverSigned: row.handover_signed,
    })),
    otClaims: otRows.parse(claims.data).map((row) => ({
      profileId: row.profile_id,
      workDate: row.work_date,
      hours: row.hours,
      status: row.status,
    })),
  });
}

/** Today's figures for a person's month, from the calendar, projects, MOFs, site log and overtime. */
export function loadLiveStats(
  kind: ReportKind,
  personId: string,
  month: CalendarDate,
  targets: ReportTargets,
): Promise<ReportStats> {
  return kind === "site"
    ? loadSiteStats(personId, month, targets)
    : loadSalesStats(kind, personId, month, targets);
}
