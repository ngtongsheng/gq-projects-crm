import type { CalendarEvent } from "@/components/app/calendar-event";
import type { AwayEntry } from "@/lib/domain/leave-away";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import { addDays, type CalendarDate } from "@/lib/format/date";

/** The first day of the month in `?month=YYYY-MM`; anything else falls back to this month. */
export function parseMonthParam(
  value: string | string[] | undefined,
  today: CalendarDate,
): CalendarDate {
  const text = typeof value === "string" ? value : "";
  const first = `${text}-01`;
  return /^\d{4}-\d{2}$/.test(text) && addDays(first, 0) === first
    ? first
    : `${today.slice(0, 7)}-01`;
}

/** The Who is away month grid: one event per person per day, public holidays first. */
export function awayEvents(
  away: ReadonlyMap<CalendarDate, readonly AwayEntry[]>,
  holidays: ReadonlyMap<CalendarDate, string>,
  nameOf: (personId: string) => string,
  href: string,
): Map<CalendarDate, CalendarEvent[]> {
  const days = new Set([...away.keys(), ...holidays.keys()]);
  return new Map(
    [...days].map((day) => {
      const holiday = holidays.get(day);
      const events: CalendarEvent[] = holiday
        ? [
            {
              id: `holiday-${day}`,
              time: "Public holiday",
              title: holiday,
              detail: "Not counted as leave",
              tone: "info",
              href,
            },
          ]
        : [];
      for (const entry of away.get(day) ?? []) {
        events.push({
          id: `${day}-${entry.personId}`,
          time: entry.halfDay ? entry.halfDay.toUpperCase() : "Full day",
          title: nameOf(entry.personId),
          detail: LEAVE_TYPE_LABEL[entry.leaveType],
          tone: "neutral",
          href,
        });
      }
      return [day, events];
    }),
  );
}
