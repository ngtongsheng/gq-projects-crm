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
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_PURPOSES,
} from "@/lib/domain/site-booking";
import { SITE_ACTIVITIES } from "@/lib/domain/site-log";
import {
  buildItinerary,
  type SiteReport,
  shootingHandoverRows,
  stockReturnCounts,
} from "@/lib/domain/site-report";
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
  approvedBy: string | null;
  approvedAt: Date | null;
};

const REPORT_COLUMNS =
  "id, profile_id, month, kind, status, stats, highlights, next_month_plan, support_needed, pass_downs_confirmed, submitted_at, reviewed_by, review_note, approved_by, approved_at";

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
    approved_by: z.string().nullable(),
    approved_at: z.string().nullable(),
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
      approvedBy: row.approved_by,
      approvedAt: row.approved_at ? new Date(row.approved_at) : null,
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

const reviewerRows = z.array(
  z.object({
    full_name: z.string().nullable(),
    step: z.enum(["review", "approve"]),
  }),
);

/** Who the signed-in person's report goes to: their team lead(s) for review, then the MD. */
export async function loadMyReportReviewers(): Promise<{
  leads: string[];
  approvers: string[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_monthly_report_reviewers");
  if (error) {
    throw new Error(`Could not load who reviews the report: ${error.message}`);
  }
  const rows = reviewerRows.parse(data);
  const names = (step: "review" | "approve") =>
    rows
      .filter((row) => row.step === step)
      .map((row) => row.full_name ?? "Unnamed")
      .sort((a, b) => a.localeCompare(b));
  return { leads: names("review"), approvers: names("approve") };
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
    mof_variation_orders: z.array(
      z.object({ confirmed_on: z.string(), amount: z.coerce.number() }),
    ),
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

  // An order counts in the month of its LOA and in the month of each of its VOs.
  const monthVos = await supabase
    .from("mof_variation_orders")
    .select("mof_id")
    .gte("confirmed_on", month)
    .lt("confirmed_on", shiftMonth(month, 1));
  if (monthVos.error) {
    throw new Error(`Could not load report figures: ${monthVos.error.message}`);
  }
  const vosMofIds = [
    ...new Set(
      z
        .array(z.object({ mof_id: z.string() }))
        .parse(monthVos.data)
        .map((row) => row.mof_id),
    ),
  ];
  const inMonth = `and(loa_date.gte.${month},loa_date.lt.${shiftMonth(month, 1)})`;

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
        "salesperson_id, loa_date, contract_sum, mof_variation_orders(confirmed_on, amount), projects(passed_by)",
      )
      .or(
        vosMofIds.length === 0
          ? inMonth
          : `${inMonth},id.in.(${vosMofIds.join(",")})`,
      ),
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
      variationOrders: row.mof_variation_orders.map((vo) => ({
        confirmedOn: vo.confirmed_on,
        amount: vo.amount,
      })),
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

const siteReportLogRows = z.array(
  z.object({
    mof_id: z.string(),
    visited_on: z.string(),
    activity: z.enum(SITE_ACTIVITIES),
    handover_signed: z.boolean(),
    drive_link: z.string().nullable(),
    mofs: z.object({
      company_name: z.string(),
      project_name: z.string(),
      project_id: z.string().nullable(),
    }),
  }),
);

const siteReportBookingRows = z.array(
  z.object({
    project_id: z.string().nullable(),
    site: z.string().nullable(),
    purpose: z.enum(BOOKING_PURPOSES),
    visit_on: z.string(),
    projects: z.object({ name: z.string() }).nullable(),
  }),
);

const siteReportLeftoverRows = z.array(
  z.object({
    destination: z.enum(["supplier", "gq"]),
    status: z.string(),
  }),
);

/**
 * A Site Supervisor's month beyond the headline figures: itinerary (booked vs added on the
 * day), shooting and handover rows, and the leftover stock they recorded. Always live: logs
 * are never edited, so a filed report's itinerary does not drift; a booking confirmed or
 * declined afterwards can.
 */
export async function loadSiteReport(
  personId: string,
  month: CalendarDate,
  today: CalendarDate,
): Promise<SiteReport> {
  const supabase = await createClient();
  const next = shiftMonth(month, 1);
  const { from, to } = monthBounds(month);
  const [logs, bookings, leftovers] = await Promise.all([
    supabase
      .from("site_logs")
      .select(
        "mof_id, visited_on, activity, handover_signed, drive_link, mofs(company_name, project_name, project_id)",
      )
      .eq("supervisor_id", personId)
      .gte("visited_on", month)
      .lt("visited_on", next),
    supabase
      .from("site_bookings")
      .select("project_id, site, purpose, visit_on, projects(name)")
      .eq("supervisor_id", personId)
      .eq("status", "confirmed")
      .gte("visit_on", month)
      .lt("visit_on", next),
    supabase
      .from("leftovers")
      .select("destination, status")
      .eq("created_by", personId)
      .gte("created_at", from)
      .lt("created_at", to),
  ]);
  for (const result of [logs, bookings, leftovers]) {
    if (result.error) {
      throw new Error(
        `Could not load the site report: ${result.error.message}`,
      );
    }
  }

  const siteLogs = siteReportLogRows.parse(logs.data).map((row) => ({
    mofId: row.mof_id,
    projectId: row.mofs.project_id,
    siteLabel: `${row.mofs.company_name} · ${row.mofs.project_name}`,
    visitedOn: row.visited_on,
    activity: row.activity,
    handoverSigned: row.handover_signed,
    driveLink: row.drive_link,
  }));
  return {
    itinerary: buildItinerary({
      month,
      today,
      logs: siteLogs,
      bookings: siteReportBookingRows.parse(bookings.data).map((row) => ({
        projectId: row.project_id,
        siteLabel: row.projects?.name ?? row.site ?? "",
        visitOn: row.visit_on,
        purposeLabel: BOOKING_PURPOSE_LABEL[row.purpose],
      })),
    }),
    shootingHandover: shootingHandoverRows(siteLogs, month),
    stockReturns: stockReturnCounts(
      siteReportLeftoverRows.parse(leftovers.data),
    ),
  };
}
