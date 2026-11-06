import { addDays, type CalendarDate, daysBetween } from "@/lib/format/date";

/** A company nobody has visited for this long is released to the other salespeople. */
export const RELEASE_AFTER_DAYS = 90;

/** The earliest day a visit still counts toward keeping a company, for a query on visit dates. */
export function releaseCutoff(today: CalendarDate): CalendarDate {
  return addDays(today, -RELEASE_AFTER_DAYS);
}

/**
 * Whether a company is released: its customers have had no completed visit or site visit for
 * 90 days, and the company itself is older than that. `lastVisit` is the latest such visit across
 * all its customers, or null when none is known.
 */
export function isReleased(
  company: { addedOn: CalendarDate; lastVisit: CalendarDate | null },
  today: CalendarDate,
): boolean {
  const since = company.lastVisit ?? company.addedOn;
  return daysBetween(since, today) > RELEASE_AFTER_DAYS;
}
