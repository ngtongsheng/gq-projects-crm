import type { CalendarDate } from "@/lib/format/date";
import { type ClaimStatus, lastMonthOf } from "./claim-flow";
import { claimMonthOf } from "./monthly-claim";

/**
 * The claim month the page opens on (demo clOpenM): this month's, unless last month's claim is
 * still being written (draft or returned) and has something in it.
 */
export function openClaimMonth(input: {
  today: CalendarDate;
  cutOffDay: number;
  previous: { status: ClaimStatus; lineCount: number } | null;
}): CalendarDate {
  const current = claimMonthOf(input.today, input.cutOffDay);
  const { previous } = input;
  return previous &&
    (previous.status === "draft" || previous.status === "returned") &&
    previous.lineCount > 0
    ? lastMonthOf(current)
    : current;
}
