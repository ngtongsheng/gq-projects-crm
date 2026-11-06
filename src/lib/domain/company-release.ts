import { addDays, type CalendarDate, daysBetween } from "@/lib/format/date";

/** A company nobody has visited for this long is released to the other salespeople. */
export const RELEASE_AFTER_DAYS = 90;

/** The earliest day a visit still counts toward keeping a company, for a query on visit dates. */
export function releaseCutoff(today: CalendarDate): CalendarDate {
  return addDays(today, -RELEASE_AFTER_DAYS);
}

/**
 * The companies that are released right now. Only companies with a live customer count.
 * `visitedContactIds` are the customers with a completed visit or site visit inside the last 90
 * days; one such visit keeps the whole company.
 */
export function releasedCompanyIds(input: {
  contacts: readonly { id: string; companyId: string }[];
  visitedContactIds: Iterable<string>;
  companyAddedOn: ReadonlyMap<string, CalendarDate>;
  today: CalendarDate;
}): Set<string> {
  const companyOf = new Map(
    input.contacts.map((contact) => [contact.id, contact.companyId]),
  );
  const kept = new Set(
    [...input.visitedContactIds].flatMap((id) => companyOf.get(id) ?? []),
  );
  return new Set(
    [...new Set(companyOf.values())].filter(
      (companyId) =>
        !kept.has(companyId) &&
        isReleased(
          {
            addedOn: input.companyAddedOn.get(companyId) ?? input.today,
            lastVisit: null,
          },
          input.today,
        ),
    ),
  );
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
