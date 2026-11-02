import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { type CalendarDate, dayOfWeek, formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { type CalendarEvent, CalendarEventLink } from "./calendar-event";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type WeekListProps<T extends CalendarEvent> = {
  /** The seven days from `weekDays`, or any run of days to list. */
  days: CalendarDate[];
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, T[]>;
  /** Draws an event in place of the default link, e.g. a card with actions. */
  renderEvent?: (event: T) => ReactNode;
  /** Shown for a day with no events. */
  emptyText?: string;
  /** Where a day's "Add" goes; no "Add" when absent (read-only roles). */
  addHref?: (date: CalendarDate) => string;
};

/** One row per day, the phone-friendly way to read a week. */
export function WeekList<T extends CalendarEvent>({
  days,
  today,
  eventsByDay,
  renderEvent,
  emptyText = "Nothing planned.",
  addHref,
}: WeekListProps<T>) {
  return (
    <ul className="flex flex-col divide-y rounded-lg border bg-card">
      {days.map((date) => {
        const events = eventsByDay.get(date) ?? [];
        return (
          <li
            key={date}
            className="grid gap-2 p-3 sm:grid-cols-[10rem_1fr] sm:gap-4"
          >
            <div className="flex items-start justify-between gap-2 sm:flex-col sm:justify-start">
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    date === today && "text-primary",
                  )}
                >
                  {WEEKDAY_NAMES[dayOfWeek(date)]}
                  {date === today && " · Today"}
                </p>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDate(date)}
                </p>
              </div>
              {addHref && (
                <Link
                  href={addHref(date)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add
                </Link>
              )}
            </div>
            {events.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) =>
                  renderEvent ? (
                    <div key={event.id}>{renderEvent(event)}</div>
                  ) : (
                    <CalendarEventLink key={event.id} event={event} />
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{emptyText}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
