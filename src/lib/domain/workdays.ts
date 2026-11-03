import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";
import { endOfMonth, shiftMonth, startOfMonth } from "./calendar-grid";

// Monday to Friday. Public holidays are not counted (see docs/debt.md).
function isWorkday(date: CalendarDate): boolean {
  const day = dayOfWeek(date);
  return day >= 1 && day <= 5;
}

function countWorkdays(from: CalendarDate, toInclusive: CalendarDate): number {
  let count = 0;
  for (let day = from; day <= toInclusive; day = addDays(day, 1)) {
    if (isWorkday(day)) count++;
  }
  return count;
}

export function workdaysInMonth(date: CalendarDate): number {
  return countWorkdays(startOfMonth(date), endOfMonth(date));
}

// Workdays from the 1st of the month up to and including `date`.
export function workdaysElapsed(date: CalendarDate): number {
  return countWorkdays(startOfMonth(date), date);
}

// Share of the month's workdays that have passed, 0 to 1. Used to compare targets with progress.
export function pace(date: CalendarDate): number {
  return workdaysElapsed(date) / workdaysInMonth(date);
}

export function firstMondayOfNextMonth(date: CalendarDate): CalendarDate {
  let day = shiftMonth(date, 1);
  while (dayOfWeek(day) !== 1) day = addDays(day, 1);
  return day;
}
