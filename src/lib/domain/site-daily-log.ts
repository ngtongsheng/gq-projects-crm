import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";
import {
  type LoggedSiteJob,
  type PlannedSiteJob,
  plannedJobsNotRecorded,
  type SiteDayInput,
  sameSite,
} from "./site-log";
import { isWorkday, type WorkCalendar } from "./workdays";

/** What one supervisor's day shows in the daily log grid (demo: siteRemind). */
export type DailyLogCell =
  | { kind: "no-site-work"; reason: "sunday" | "holiday" }
  | { kind: "logged"; sites: number }
  | { kind: "away"; label: string }
  | { kind: "today"; reminderGone: boolean }
  | { kind: "before-joined" }
  | { kind: "missing" };

/**
 * One day for one supervisor: logged, away (office, other, leave, MC), not due yet or missing.
 * A day nobody works on (Sunday, public holiday) never asks for a log.
 */
export function dailyLogCell(input: {
  day: CalendarDate;
  today: CalendarDate;
  calendar: WorkCalendar;
  /** Different sites logged that day. */
  sitesLogged: number;
  /** Why they were away that day, already worded, or null. */
  awayLabel: string | null;
  joinedOn: CalendarDate | null;
  /** The reminder time has passed today. */
  reminderTimePassed: boolean;
}): DailyLogCell {
  if (!isWorkday(input.day, input.calendar)) {
    return {
      kind: "no-site-work",
      reason: dayOfWeek(input.day) === 0 ? "sunday" : "holiday",
    };
  }
  if (input.sitesLogged > 0)
    return { kind: "logged", sites: input.sitesLogged };
  if (input.awayLabel) return { kind: "away", label: input.awayLabel };
  if (input.day === input.today) {
    return { kind: "today", reminderGone: input.reminderTimePassed };
  }
  if (input.joinedOn && input.day < input.joinedOn) {
    return { kind: "before-joined" };
  }
  return { kind: "missing" };
}

/** The last `count` days ending today, oldest first: the grid's columns. */
export const gridDays = (today: CalendarDate, count: number): CalendarDate[] =>
  Array.from({ length: count }, (_, index) =>
    addDays(today, index - (count - 1)),
  );

const siteDay = (log: LoggedSiteJob) =>
  `${log.visitedOn}|${log.mofId ?? log.projectId ?? log.siteName?.toLowerCase()}`;

export type PlanVsDone<Job extends PlannedSiteJob> = {
  planned: Job[];
  /** Planned and a log at that site that day. */
  done: Job[];
  /** Planned on a day they were due on site, with nothing logged there. */
  notLogged: Job[];
  /** Sites logged on a day that were not in the schedule: they still count. */
  addedOnTheDay: LoggedSiteJob[];
};

/**
 * The calendar's plan against the site log for the past week (demo: planVsDone). "Didn't go"
 * reasons have no table yet, so a missed job stays "not logged" until it is recorded.
 */
export function planVsDone<Job extends PlannedSiteJob>(
  input: SiteDayInput & {
    planned: readonly Job[];
    logs: readonly LoggedSiteJob[];
  },
): PlanVsDone<Job> {
  const notLogged = plannedJobsNotRecorded(input);
  const done = input.planned.filter((job) =>
    input.logs.some((log) => log.visitedOn === job.day && sameSite(job, log)),
  );
  const seen = new Set<string>();
  const addedOnTheDay = input.logs.filter((log) => {
    const key = siteDay(log);
    if (seen.has(key)) return false;
    seen.add(key);
    return !input.planned.some(
      (job) => job.day === log.visitedOn && sameSite(job, log),
    );
  });
  return { planned: [...input.planned], done, notLogged, addedOnTheDay };
}
