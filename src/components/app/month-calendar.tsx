import { Plus } from "lucide-react";
import Link from "next/link";
import { isSameMonth } from "@/lib/domain/calendar-grid";
import { type CalendarDate, dayOfWeek, formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { type CalendarEvent, CalendarEventLink } from "./calendar-event";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVENTS_PER_DAY = 3;

type MonthCalendarProps = {
  /** Monday-to-Sunday rows from `monthWeeks`. */
  weeks: CalendarDate[][];
  /** Any day of the month being shown; days outside it are dimmed. */
  month: CalendarDate;
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, CalendarEvent[]>;
  /** Where a day's "+" goes; no "+" when absent (read-only roles). */
  addHref?: (date: CalendarDate) => string;
  /** Where "+N more" goes, usually the week view for that day. */
  dayHref: (date: CalendarDate) => string;
  /** What a day holds, for the "+" label and the phone count. Defaults to activities. */
  noun?: { one: string; many: string };
};

export function MonthCalendar({
  weeks,
  month,
  today,
  eventsByDay,
  addHref,
  dayHref,
  noun = { one: "activity", many: "activities" },
}: MonthCalendarProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-border">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((name) => (
          <div
            key={name}
            className="bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
          >
            {name}
          </div>
        ))}
        {weeks.flat().map((date) => {
          const events = eventsByDay.get(date) ?? [];
          const hidden = events.length - EVENTS_PER_DAY;
          const isWeekend = dayOfWeek(date) === 0 || dayOfWeek(date) === 6;
          return (
            <div
              key={date}
              className={cn(
                "flex min-h-24 min-w-0 flex-col gap-1 p-1.5 sm:min-h-32",
                isWeekend ? "bg-muted" : "bg-card",
                !isSameMonth(date, month) && "opacity-50",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "rounded-md px-1.5 font-mono text-sm tabular-nums",
                    date === today && "bg-primary text-primary-foreground",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                {addHref && (
                  <Link
                    href={addHref(date)}
                    aria-label={`Add ${noun.one} on ${formatDate(date)}`}
                    className="rounded-md p-0.5 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </Link>
                )}
              </div>
              <div className="hidden min-w-0 flex-col gap-1 sm:flex">
                {events.slice(0, EVENTS_PER_DAY).map((event) => (
                  <CalendarEventLink key={event.id} event={event} />
                ))}
                {hidden > 0 && (
                  <Link
                    href={dayHref(date)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    +{hidden} more
                  </Link>
                )}
              </div>
              {events.length > 0 && (
                <Link
                  href={dayHref(date)}
                  className="text-xs font-medium text-info sm:hidden"
                >
                  {events.length} {events.length === 1 ? noun.one : noun.many}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
