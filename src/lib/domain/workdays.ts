import type { JobRole } from "@/lib/auth/job-role";
import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";
import { endOfMonth, shiftMonth, startOfMonth } from "./calendar-grid";

/** Site Supervisors work Monday to Saturday (D11); everyone else Monday to Friday. */
export type WeekKind = "mon-fri" | "mon-sat";

/** Which days count as working days: the week pattern, minus public holidays. */
export type WorkCalendar = {
  week: WeekKind;
  holidays: ReadonlySet<CalendarDate>;
};

export const weekKindFor = (jobRole: JobRole): WeekKind =>
  jobRole === "site" ? "mon-sat" : "mon-fri";

export function isWorkday(date: CalendarDate, calendar: WorkCalendar): boolean {
  const day = dayOfWeek(date);
  const lastDay = calendar.week === "mon-sat" ? 6 : 5;
  return day >= 1 && day <= lastDay && !calendar.holidays.has(date);
}

function countWorkdays(
  from: CalendarDate,
  toInclusive: CalendarDate,
  calendar: WorkCalendar,
): number {
  let count = 0;
  for (let day = from; day <= toInclusive; day = addDays(day, 1)) {
    if (isWorkday(day, calendar)) count++;
  }
  return count;
}

export function workdaysInMonth(
  date: CalendarDate,
  calendar: WorkCalendar,
): number {
  return countWorkdays(startOfMonth(date), endOfMonth(date), calendar);
}

// Workdays from the 1st of the month up to and including `date`.
export function workdaysElapsed(
  date: CalendarDate,
  calendar: WorkCalendar,
): number {
  return countWorkdays(startOfMonth(date), date, calendar);
}

// Share of the month's workdays that have passed, 0 to 1. Used to compare targets with progress.
export function pace(date: CalendarDate, calendar: WorkCalendar): number {
  const total = workdaysInMonth(date, calendar);
  return total === 0 ? 0 : workdaysElapsed(date, calendar) / total;
}

export function firstMondayOfNextMonth(date: CalendarDate): CalendarDate {
  let day = shiftMonth(date, 1);
  while (dayOfWeek(day) !== 1) day = addDays(day, 1);
  return day;
}
