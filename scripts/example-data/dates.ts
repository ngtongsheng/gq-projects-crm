import { addDays, type CalendarDate } from "../../src/lib/format/date.ts";

/** A Malaysia-time timestamp `days` from `today`, e.g. at(today, -2, "10:30"). */
export function at(today: CalendarDate, days: number, clock: string): string {
  return `${addDays(today, days)}T${clock}:00+08:00`;
}

export function monthStart(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 8)}01`;
}

export function previousMonthStart(date: CalendarDate): CalendarDate {
  return monthStart(addDays(monthStart(date), -1));
}
