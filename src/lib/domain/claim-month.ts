import { z } from "zod";
import { addDays, type CalendarDate } from "@/lib/format/date";

// Mirrors app_settings_claims_check: only the cut-off day is still used (loop 25, D7).
export const ClaimSettings = z.object({
  cutOffDay: z
    .number({ error: "Enter the cut-off day as a number." })
    .int("Enter the cut-off day as a whole day.")
    .min(1, "The cut-off day must be between 1 and 28.")
    .max(28, "The cut-off day must be between 1 and 28."),
});
export type ClaimSettings = z.infer<typeof ClaimSettings>;

const pad = (n: number) => String(n).padStart(2, "0");

/** The first day of the month after the one a date falls in. */
function nextMonthStart(date: CalendarDate): CalendarDate {
  const [year, month] = date.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
}

/** The claim month (its first day) a date belongs to: days after the cut-off roll into the next month. */
export function claimMonthOf(
  date: CalendarDate,
  cutOffDay: number,
): CalendarDate {
  const day = Number(date.slice(8, 10));
  return day <= cutOffDay ? `${date.slice(0, 8)}01` : nextMonthStart(date);
}

/** The days a claim month covers: the day after last month's cut-off up to this month's. */
export function claimPeriod(
  month: CalendarDate,
  cutOffDay: number,
): { from: CalendarDate; to: CalendarDate } {
  const previousMonth = addDays(month, -1).slice(0, 8);
  return {
    from: addDays(`${previousMonth}${pad(cutOffDay)}`, 1),
    to: `${month.slice(0, 8)}${pad(cutOffDay)}`,
  };
}
