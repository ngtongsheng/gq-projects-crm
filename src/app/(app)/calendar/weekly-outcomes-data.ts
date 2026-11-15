import { canLeadTeam, type JobRole } from "@/lib/auth/job-role";
import { inMyTeam } from "@/lib/auth/team";
import { startOfWeek } from "@/lib/domain/calendar-grid";
import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";
import { activityDay } from "../activities/last-activity";
import { needsOutcome, type VisitResult } from "../activities/outcome-schema";
import type { ActivityStatus, ActivityType } from "../activities/schemas";

/** The activity types that count as visits, as in the demo and the monthly reports. */
const VISIT_TYPES: readonly ActivityType[] = ["visit", "site_visit", "walk_in"];

export type OutcomeActivity = {
  id: string;
  ownerId: string;
  type: ActivityType;
  status: ActivityStatus;
  startsAt: string;
  result: VisitResult | null;
  /** What was learned about the company. */
  outcome: string | null;
  /** Stamped by the database when the outcome came in after the week's deadline. */
  lateLogged: boolean;
  loggedAt: string | null;
  leadProjectId: string | null;
  /** The project lead raised at this visit; null when there is none or the viewer can't read it. */
  lead: { name: string; value: number } | null;
  customer: string;
  company: string;
};

export type WeeklyReport = {
  id: string;
  profileId: string;
  status: "submitted" | "reviewed";
  note: string | null;
  submittedAt: string;
  /** Stamped by the database: submitted after the week's deadline. */
  late: boolean;
  reviewNote: string | null;
};

export type ReportState =
  | { kind: "submitted" | "reviewed"; report: WeeklyReport }
  | { kind: "due" | "not_submitted" | "not_expected" };

export type OutcomesRow = {
  id: string;
  name: string;
  visitsDone: number;
  logged: number;
  notLogged: number;
  lateLogged: number;
  results: { result: VisitResult; count: number }[];
  leads: number;
  leadValue: number;
  report: ReportState;
  activities: OutcomeActivity[];
};

/** Monday and Sunday of the week holding `date`. */
export function outcomesWeek(date: CalendarDate) {
  const monday = startOfWeek(date);
  return { monday, sunday: addDays(monday, 6) };
}

/**
 * The week the tab opens on. On Monday the sales meeting goes through the week just ended, so
 * it opens on that one; every other day it opens on the current week.
 */
export function defaultOutcomesDate(today: CalendarDate): CalendarDate {
  return dayOfWeek(today) === 1 ? addDays(today, -7) : today;
}

/** Salespeople and the Marketing Director file a weekly report (SQL: the insert policy on weekly_reports). */
export const filesWeeklyReport = (jobRole: JobRole) =>
  jobRole === "sales" || jobRole === "bd";

/**
 * The MD, or the Sales or Marketing Director whose team the writer is in; never the writer.
 * Mirrors public.can_review_weekly_report(), which is the real gate.
 */
export function canReviewWeeklyReport(
  me: { id: string; jobRole: JobRole },
  writerId: string,
  team: readonly string[] | null,
): boolean {
  if (writerId === me.id) return false;
  if (me.jobRole === "md") return true;
  return canLeadTeam(me.jobRole) && inMyTeam(team, writerId);
}

/**
 * One row per salesperson for the week. With a `scope` list, exactly those people; with null
 * (everyone), the report filers plus anyone with an activity or report that week.
 */
export function weeklyOutcomes(input: {
  week: CalendarDate;
  scope: readonly string[] | null;
  filers: ReadonlySet<string>;
  nameOf: ReadonlyMap<string, string>;
  activities: readonly OutcomeActivity[];
  reports: readonly WeeklyReport[];
  dueAt: Date;
  now: Date;
}): OutcomesRow[] {
  const { monday, sunday } = outcomesWeek(input.week);
  const inWeek = input.activities.filter((a) => {
    const day = activityDay(a.startsAt);
    return a.status !== "cancelled" && day >= monday && day <= sunday;
  });
  const ids =
    input.scope ??
    new Set([
      ...input.filers,
      ...inWeek.map((a) => a.ownerId),
      ...input.reports.map((r) => r.profileId),
    ]);

  return [...ids]
    .map((id) => {
      const own = inWeek
        .filter((a) => a.ownerId === id)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const done = own.filter((a) => a.status === "completed");
      const leads = done.filter((a) => a.leadProjectId !== null);
      return {
        id,
        name: input.nameOf.get(id) ?? "Unnamed",
        visitsDone: done.filter((a) => VISIT_TYPES.includes(a.type)).length,
        logged: done.length,
        notLogged: own.filter((a) => needsOutcome(a, input.now)).length,
        lateLogged: done.filter((a) => a.lateLogged).length,
        results: countResults(done),
        leads: leads.length,
        leadValue: leads.reduce((total, a) => total + (a.lead?.value ?? 0), 0),
        report: reportState({
          report: input.reports.find((r) => r.profileId === id),
          expected: input.filers.has(id),
          overdue: input.now > input.dueAt,
        }),
        activities: own,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function countResults(done: readonly OutcomeActivity[]) {
  const counts = new Map<VisitResult, number>();
  for (const a of done) {
    if (a.result) counts.set(a.result, (counts.get(a.result) ?? 0) + 1);
  }
  return [...counts].map(([result, count]) => ({ result, count }));
}

function reportState(input: {
  report: WeeklyReport | undefined;
  expected: boolean;
  overdue: boolean;
}): ReportState {
  if (input.report) return { kind: input.report.status, report: input.report };
  if (!input.expected) return { kind: "not_expected" };
  return { kind: input.overdue ? "not_submitted" : "due" };
}
