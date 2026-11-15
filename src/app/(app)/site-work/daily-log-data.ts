import type { AwayRange } from "@/lib/domain/site-log";
import { type PlannedWork, plannedWork } from "@/lib/domain/site-plan";
import { addDays, type CalendarDate } from "@/lib/format/date";
import { loadCalendarJobs } from "../installation/calendar-jobs";
import type { LeaveRow } from "../leave/leave-view";
import {
  loadMyBookings,
  loadMyLogs,
  loadMySiteOff,
  type MyLog,
  type SiteOffDay,
} from "../today/today-data";

/** How far back the daily log looks: this week's grid and the plan against the log. */
export const DAILY_LOG_DAYS = 7;

export type SupervisorWeek = {
  id: string;
  name: string;
  joinedOn: CalendarDate | null;
  /** Their logs from a week ago up to and including today. */
  logs: MyLog[];
  /** Why they were away: office and other days, and approved leave or MC. */
  away: (AwayRange & { label: string })[];
  /** What the calendar planned for them from a week ago up to yesterday. */
  planned: PlannedWork[];
};

/** One supervisor's past week: what they logged, where they were away and what was planned. */
export async function loadSupervisorWeek(input: {
  supervisor: { id: string; name: string; joinedOn: CalendarDate | null };
  today: CalendarDate;
  leave: readonly LeaveRow[];
  leaveLabel: (leave: LeaveRow) => string;
  siteOffLabel: (kind: SiteOffDay["kind"]) => string;
}): Promise<SupervisorWeek> {
  const { supervisor, today } = input;
  const from = addDays(today, -DAILY_LOG_DAYS);
  const yesterday = addDays(today, -1);
  const [logs, off, jobs, bookings] = await Promise.all([
    loadMyLogs(supervisor.id, from, today),
    loadMySiteOff(supervisor.id, from, today),
    loadCalendarJobs(from, yesterday, supervisor.id),
    loadMyBookings(supervisor.id, from, yesterday),
  ]);
  const leave = input.leave.filter(
    (row) => row.personId === supervisor.id && row.status === "approved",
  );
  return {
    ...supervisor,
    logs,
    away: [
      ...off.map((entry) => ({
        startsOn: entry.startsOn,
        endsOn: entry.endsOn,
        label: input.siteOffLabel(entry.kind),
      })),
      ...leave.map((row) => ({
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        label: input.leaveLabel(row),
      })),
    ],
    planned: plannedWork({ from, to: yesterday, jobs, bookings }),
  };
}
