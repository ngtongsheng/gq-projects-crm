import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { CalendarEvent } from "@/components/app/calendar-event";
import { MonthCalendar } from "@/components/app/month-calendar";
import { Button } from "@/components/ui/button";
import {
  formatMonthTitle,
  monthWeeks,
  shiftMonth,
} from "@/lib/domain/calendar-grid";
import { type CalendarDate, dayOfWeek, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveSection } from "./leave-section";

const monthHref = (month: CalendarDate) => `/leave?month=${month.slice(0, 7)}`;
const LIST_ID = "away-list";

/** The demo's Who is away: a month grid on wider screens, the same days as a list on a phone. */
export function AwaySection({
  month,
  today,
  eventsByDay,
  t,
}: {
  t: Translate;
  /** The first day of the month shown. */
  month: CalendarDate;
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, CalendarEvent[]>;
}) {
  const listed = [...eventsByDay.entries()]
    .filter(([day]) => day.startsWith(month.slice(0, 7)))
    .sort(([a], [b]) => a.localeCompare(b));
  return (
    <LeaveSection
      title={`${t("Who is away")} · ${formatMonthTitle(month)}`}
      action={
        <div className="flex items-center gap-1">
          <Button asChild size="icon-sm" variant="outline">
            <Link
              href={monthHref(shiftMonth(month, -1))}
              aria-label={t("Previous month")}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild size="icon-sm" variant="outline">
            <Link
              href={monthHref(shiftMonth(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={monthHref(today)}>{t("Today")}</Link>
          </Button>
        </div>
      }
    >
      <MonthCalendar
        weeks={monthWeeks(month)}
        month={month}
        today={today}
        eventsByDay={eventsByDay}
        dayHref={() => `#${LIST_ID}`}
        noun={{ one: "listed", many: "listed" }}
        eventsPerDay={50}
      />
      <ul id={LIST_ID} className="flex flex-col gap-1 sm:hidden">
        {listed.length === 0 && (
          <li className="text-sm text-muted-foreground">
            {t("Nobody on leave this month.")}
          </li>
        )}
        {listed.map(([day, events]) => (
          <li key={day} className="rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="font-mono tabular-nums">
              {dayName(day)} {formatDate(day)}
            </span>
            <span className="block text-muted-foreground">
              {events
                .map((event) =>
                  event.time === "Public holiday"
                    ? `${t("Public holiday")} · ${event.title}`
                    : event.title,
                )
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </LeaveSection>
  );
}

const dayName = (day: CalendarDate) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek(day)];
