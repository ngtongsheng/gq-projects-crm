import { claimMonthOf, claimPeriod } from "@/lib/domain/claim-month";
import {
  addDays,
  type CalendarDate,
  formatDate,
  formatMonth,
} from "@/lib/format/date";

/** How many claim months the month selector offers: the current one and five before it. */
const MONTHS_OFFERED = 6;

/** The claim months a person can pick, newest first: the claim month of today and the five before it. */
export function travelClaimMonths(
  today: CalendarDate,
  cutOffDay: number,
): CalendarDate[] {
  const months = [claimMonthOf(today, cutOffDay)];
  while (months.length < MONTHS_OFFERED) {
    const last = months[months.length - 1];
    months.push(`${addDays(last, -1).slice(0, 8)}01`);
  }
  return months;
}

// formatDate gives "26 Oct 2026"; the label drops the year, which the month name already carries.
const dayAndMonth = (date: CalendarDate) => formatDate(date).slice(0, -5);

/** "Nov 2026 (26 Oct – 25 Nov)": the month and the days its claim covers. */
export function travelClaimMonthLabel(
  month: CalendarDate,
  cutOffDay: number,
): string {
  const { from, to } = claimPeriod(month, cutOffDay);
  return `${formatMonth(month)} (${dayAndMonth(from)} – ${dayAndMonth(to)})`;
}
