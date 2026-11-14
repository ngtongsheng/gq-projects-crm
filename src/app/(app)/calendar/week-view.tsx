import {
  type CalendarEvent,
  CalendarEventLink,
} from "@/components/app/calendar-event";
import { WeekList } from "@/components/app/week-list";
import type { CalendarDate } from "@/lib/format/date";
import { InvitationCard } from "./invitation-card";

type WeekViewProps = {
  days: CalendarDate[];
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, CalendarEvent[]>;
  /** Where a day's "Add" goes; absent for read-only roles. */
  addHref?: (date: CalendarDate) => string;
};

/** The Week tab: one row per day, an invitation waiting for a reply shown with its answers. */
export function WeekView({ days, today, eventsByDay, addHref }: WeekViewProps) {
  return (
    <WeekList
      days={days}
      today={today}
      eventsByDay={eventsByDay}
      addHref={addHref}
      renderEvent={(event) =>
        event.awaitingReply ? (
          <InvitationCard event={event} />
        ) : (
          <CalendarEventLink event={event} />
        )
      }
    />
  );
}
