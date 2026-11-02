import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";

const DAYS_IN_WEEK = 7;

/** Monday of the week that holds `date` (weeks start on Monday). */
export function startOfWeek(date: CalendarDate): CalendarDate {
  const sinceMonday = (dayOfWeek(date) + 6) % DAYS_IN_WEEK;
  return addDays(date, -sinceMonday);
}

/** The seven days, Monday to Sunday, of the week that holds `date`. */
export function weekDays(date: CalendarDate): CalendarDate[] {
  const monday = startOfWeek(date);
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(monday, i));
}

/** The first day of the month `months` away from the month of `date`. */
export function shiftMonth(date: CalendarDate, months: number): CalendarDate {
  const [year, month] = date.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = (index % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, "0")}-01`;
}

export const startOfMonth = (date: CalendarDate): CalendarDate =>
  shiftMonth(date, 0);

export const endOfMonth = (date: CalendarDate): CalendarDate =>
  addDays(shiftMonth(date, 1), -1);

export const isSameMonth = (a: CalendarDate, b: CalendarDate): boolean =>
  a.slice(0, 7) === b.slice(0, 7);

/**
 * The weeks to draw for the month of `date`: Monday to Sunday rows, padded with
 * the neighbouring months' days so every row has seven days.
 */
export function monthWeeks(date: CalendarDate): CalendarDate[][] {
  const last = endOfMonth(date);
  const weeks: CalendarDate[][] = [];
  for (
    let monday = startOfWeek(startOfMonth(date));
    monday <= last;
    monday = addDays(monday, DAYS_IN_WEEK)
  ) {
    weeks.push(weekDays(monday));
  }
  return weeks;
}

/** e.g. "November 2026". */
export function formatMonthTitle(date: CalendarDate): string {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
