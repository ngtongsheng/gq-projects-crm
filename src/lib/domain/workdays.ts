import { addDays, type CalendarDate, dayOfWeek } from "@/lib/format/date";

// Monday to Friday. Public holidays are not counted (see docs/debt.md).
function isWorkday(date: CalendarDate): boolean {
  const day = dayOfWeek(date);
  return day >= 1 && day <= 5;
}

function monthStart(date: CalendarDate): CalendarDate {
  return `${date.slice(0, 7)}-01`;
}

function nextMonthStart(date: CalendarDate): CalendarDate {
  const [year, month] = date.split("-").map(Number);
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function countWorkdays(from: CalendarDate, toInclusive: CalendarDate): number {
  let count = 0;
  for (let day = from; day <= toInclusive; day = addDays(day, 1)) {
    if (isWorkday(day)) count++;
  }
  return count;
}

export function workdaysInMonth(date: CalendarDate): number {
  return countWorkdays(monthStart(date), addDays(nextMonthStart(date), -1));
}

// Workdays from the 1st of the month up to and including `date`.
export function workdaysElapsed(date: CalendarDate): number {
  return countWorkdays(monthStart(date), date);
}

// Share of the month's workdays that have passed, 0 to 1. Used to compare targets with progress.
export function pace(date: CalendarDate): number {
  return workdaysElapsed(date) / workdaysInMonth(date);
}

export function firstMondayOfNextMonth(date: CalendarDate): CalendarDate {
  let day = nextMonthStart(date);
  while (dayOfWeek(day) !== 1) day = addDays(day, 1);
  return day;
}
