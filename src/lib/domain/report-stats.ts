import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { isSameMonth, startOfMonth } from "@/lib/domain/calendar-grid";
import { orderTotal } from "@/lib/domain/mof-totals";
import { firstMondayOfNextMonth, pace } from "@/lib/domain/workdays";
import type { CalendarDate } from "@/lib/format/date";
import { sumRm } from "@/lib/format/money";

export const REPORT_KINDS = ["sales", "bd", "site"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Rows of highlights on the report form. */
export const HIGHLIGHT_ROWS = 4;

export const REPORT_STATUSES = ["draft", "submitted", "reviewed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** The report a job role files, or null for roles that review instead. Mirrors the SQL guard. */
export function reportKindFor(jobRole: JobRole): ReportKind | null {
  if (jobRole === "sales" || jobRole === "bd" || jobRole === "site") {
    return jobRole;
  }
  return null;
}

/** MD or Sales Director for sales and site reports; only the MD for the BD Director's. */
export function canReviewReport(jobRole: JobRole, kind: ReportKind): boolean {
  return kind === "bd"
    ? jobRole === "md"
    : jobRole === "md" || jobRole === "director";
}

export const ReportTargets = z.object({
  salesVisits: z.number().nonnegative().catch(50),
  siteVisits: z.number().nonnegative().catch(50),
  shootings: z.number().nonnegative().catch(5),
  handovers: z.number().nonnegative().catch(5),
});
export type ReportTargets = z.infer<typeof ReportTargets>;

const SalesFigures = z.object({
  visits: z.number(),
  visitTarget: z.number(),
  newCustomers: z.number(),
  quotations: z.number(),
  awardedCount: z.number(),
  awardedValue: z.number(),
});

/** The figures frozen into a report when it is submitted, one shape per kind. */
export const ReportStats = z.discriminatedUnion("kind", [
  SalesFigures.extend({ kind: z.literal("sales") }),
  SalesFigures.extend({
    kind: z.literal("bd"),
    passDownCount: z.number(),
    passDownValue: z.number(),
  }),
  z.object({
    kind: z.literal("site"),
    siteVisits: z.number(),
    siteVisitTarget: z.number(),
    shootings: z.number(),
    shootingTarget: z.number(),
    handovers: z.number(),
    handoverTarget: z.number(),
    otHours: z.number(),
  }),
]);
export type ReportStats = z.infer<typeof ReportStats>;

/** A completed visit, site visit or showroom walk-in, on its Malaysia date. */
export type ReportVisit = {
  contactId: string;
  ownerId: string;
  day: CalendarDate;
};

export type ReportProject = {
  picId: string;
  stage: string;
  /** Malaysia date the project was added. */
  createdOn: CalendarDate;
};

export type ReportOrder = {
  salespersonId: string;
  /** Who passed the project down, from Projects. */
  passedBy: string | null;
  loaDate: CalendarDate;
  contractSum: number;
  voAmount: number;
};

export type SalesInput = {
  personId: string;
  /** First of the month, "YYYY-MM-01". */
  month: CalendarDate;
  /** Every completed visit up to the end of the month for the contacts this person visited in it. */
  visits: readonly ReportVisit[];
  projects: readonly ReportProject[];
  orders: readonly ReportOrder[];
  targets: ReportTargets;
};

/** Who first met each contact, and when: the earliest visit by anyone. */
function firstVisits(visits: readonly ReportVisit[]): Map<string, ReportVisit> {
  const first = new Map<string, ReportVisit>();
  for (const visit of visits) {
    const seen = first.get(visit.contactId);
    if (!seen || visit.day < seen.day) first.set(visit.contactId, visit);
  }
  return first;
}

function salesFigures(input: SalesInput): z.infer<typeof SalesFigures> {
  const { personId, month } = input;
  const visits = input.visits.filter(
    (visit) => visit.ownerId === personId && isSameMonth(visit.day, month),
  );
  const newCustomers = [...firstVisits(input.visits).values()].filter(
    (first) => first.ownerId === personId && isSameMonth(first.day, month),
  ).length;
  // No quotation date is stored yet (docs/debt.md): a project added this month that got past lead.
  const quotations = input.projects.filter(
    (project) =>
      project.picId === personId &&
      project.stage !== "lead" &&
      isSameMonth(project.createdOn, month),
  ).length;
  const awarded = input.orders.filter(
    (order) =>
      order.salespersonId === personId && isSameMonth(order.loaDate, month),
  );
  return {
    visits: visits.length,
    visitTarget: input.targets.salesVisits,
    newCustomers,
    quotations,
    awardedCount: awarded.length,
    awardedValue: sumRm(awarded.map(orderTotal)),
  };
}

export function salesStats(input: SalesInput): ReportStats {
  return { kind: "sales", ...salesFigures(input) };
}

/** Sales figures plus the orders awarded this month on projects the BD Director passed down. */
export function bdStats(input: SalesInput): ReportStats {
  const passedDown = input.orders.filter(
    (order) =>
      order.passedBy === input.personId &&
      order.salespersonId !== input.personId &&
      isSameMonth(order.loaDate, input.month),
  );
  return {
    kind: "bd",
    ...salesFigures(input),
    passDownCount: passedDown.length,
    passDownValue: sumRm(passedDown.map(orderTotal)),
  };
}

export type SiteInput = {
  personId: string;
  month: CalendarDate;
  siteLogs: readonly {
    supervisorId: string;
    mofId: string;
    visitedOn: CalendarDate;
    activity: string;
    handoverSigned: boolean;
  }[];
  otClaims: readonly {
    profileId: string;
    workDate: CalendarDate;
    hours: number;
    status: string;
  }[];
  targets: ReportTargets;
};

export function siteStats(input: SiteInput): ReportStats {
  const logs = input.siteLogs.filter(
    (log) =>
      log.supervisorId === input.personId &&
      isSameMonth(log.visitedOn, input.month),
  );
  // A site visit is one site on one day, however many activities were logged there.
  const siteVisits = new Set(logs.map((log) => `${log.visitedOn}|${log.mofId}`))
    .size;
  const otHours = input.otClaims
    .filter(
      (claim) =>
        claim.profileId === input.personId &&
        claim.status !== "rejected" &&
        isSameMonth(claim.workDate, input.month),
    )
    .reduce((total, claim) => total + Math.round(claim.hours * 10), 0);
  return {
    kind: "site",
    siteVisits,
    siteVisitTarget: input.targets.siteVisits,
    shootings: logs.filter((log) => log.activity === "shooting").length,
    shootingTarget: input.targets.shootings,
    handovers: logs.filter(
      (log) => log.activity === "handover" && log.handoverSigned,
    ).length,
    handoverTarget: input.targets.handovers,
    // Hours are kept to one decimal; summing tenths avoids float drift.
    otHours: otHours / 10,
  };
}

/** When a month's report is due: the first Monday of the next month at the due time, Malaysia time. */
export function reportDueAt(month: CalendarDate, dueTime: string): Date {
  return new Date(`${firstMondayOfNextMonth(month)}T${dueTime}:00+08:00`);
}

export function isLate(
  month: CalendarDate,
  dueTime: string,
  submittedAt: Date,
): boolean {
  return submittedAt.getTime() > reportDueAt(month, dueTime).getTime();
}

export type ReportFlag = {
  label: string;
  tone: "good" | "info" | "warn" | "bad" | "neutral";
};

/** The status shown on a report, with late submissions and overdue drafts flagged. */
export function reportFlag(input: {
  month: CalendarDate;
  dueTime: string;
  status: ReportStatus | null;
  submittedAt: Date | null;
  now: Date;
}): ReportFlag {
  const late =
    input.submittedAt !== null &&
    isLate(input.month, input.dueTime, input.submittedAt);
  if (input.status === "reviewed") {
    return late
      ? { label: "Reviewed · submitted late", tone: "warn" }
      : { label: "Reviewed", tone: "good" };
  }
  if (input.status === "submitted") {
    return late
      ? { label: "Submitted late", tone: "warn" }
      : { label: "Submitted on time", tone: "info" };
  }
  if (input.now > reportDueAt(input.month, input.dueTime)) {
    return { label: "Overdue", tone: "bad" };
  }
  return input.status === "draft"
    ? { label: "Draft", tone: "neutral" }
    : { label: "Not started", tone: "neutral" };
}

/** Share of the month's workdays gone by `today`: all of a past month, none of a future one. */
export function monthPace(month: CalendarDate, today: CalendarDate): number {
  if (isSameMonth(month, today)) return pace(today);
  return startOfMonth(month) < startOfMonth(today) ? 1 : 0;
}

/** Green at 90% of where you should be by now, amber at 70%, red below. */
export function achievedTone(
  actual: number,
  target: number,
  paceShare: number,
): "good" | "warn" | "bad" | "neutral" {
  if (target <= 0) return "neutral";
  const expected = target * paceShare;
  const ratio = expected === 0 ? 1 : actual / expected;
  if (ratio >= 0.9) return "good";
  if (ratio >= 0.7) return "warn";
  return "bad";
}
