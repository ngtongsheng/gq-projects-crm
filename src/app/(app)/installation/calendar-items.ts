import type { CalendarEvent } from "@/components/app/calendar-event";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
} from "@/lib/domain/delivery-status";
import { jobsByDay } from "@/lib/domain/job-calendar";
import {
  BOOKING_PURPOSE_LABEL,
  BOOKING_STATUS_TONE,
} from "@/lib/domain/site-booking";
import type { CalendarDate } from "@/lib/format/date";
import type { CalendarBooking } from "./booking-data";
import type { CalendarJob } from "./calendar-jobs";

/** A job on the calendar: the compact event for the grid, plus the job for the list card. */
export type JobEvent = CalendarEvent & {
  kind: "job";
  startTime: string;
  job: CalendarJob;
};

/** A site supervisor booking on the calendar, with the booking for the list card. */
export type BookingEvent = CalendarEvent & {
  kind: "booking";
  startTime: string;
  booking: CalendarBooking;
};

export type CalendarItem = JobEvent | BookingEvent;

type CalendarItemsInput = {
  jobs: readonly CalendarJob[];
  bookings: readonly CalendarBooking[];
  from: CalendarDate;
  to: CalendarDate;
  supervisorName: (id: string) => string;
  /** Where an event on `day` goes, usually the week view for that day. */
  hrefFor: (day: CalendarDate) => string;
};

// Timed items first by time, then the untimed ones; equal times keep their order.
const byStartTime = (a: CalendarItem, b: CalendarItem) => {
  if (a.startTime === b.startTime) return 0;
  if (a.startTime === "") return 1;
  if (b.startTime === "") return -1;
  return a.startTime.localeCompare(b.startTime);
};

/** Jobs and site supervisor bookings by day, so the calendar shows when a supervisor is taken. */
export function calendarItems({
  jobs,
  bookings,
  from,
  to,
  supervisorName,
  hrefFor,
}: CalendarItemsInput): Map<CalendarDate, CalendarItem[]> {
  const byDay = new Map<CalendarDate, CalendarItem[]>();
  const add = (day: CalendarDate, item: CalendarItem) =>
    byDay.set(day, [...(byDay.get(day) ?? []), item]);

  for (const [day, dayJobs] of jobsByDay(jobs, from, to)) {
    for (const job of dayJobs) {
      add(day, {
        kind: "job",
        id: job.id,
        time: job.startTime || "All day",
        startTime: job.startTime,
        title: `${job.mofNo} · ${job.companyName}`,
        detail: `${JOB_TYPE_LABEL[job.jobType]} · ${JOB_STATUS_LABEL[job.status]}`,
        tone: JOB_STATUS_TONE[job.status],
        href: hrefFor(day),
        muted: job.status === "postponed",
        job,
      });
    }
  }
  for (const booking of bookings) {
    if (booking.visitOn < from || booking.visitOn > to) continue;
    add(booking.visitOn, {
      kind: "booking",
      // Prefixed so a booking never shares a key with a job in the same day.
      id: `booking-${booking.id}`,
      time: booking.startTime,
      startTime: booking.startTime,
      title: `${BOOKING_PURPOSE_LABEL[booking.purpose]} · ${supervisorName(booking.supervisorId)}`,
      detail: booking.siteLabel,
      tone: BOOKING_STATUS_TONE[booking.status],
      href: hrefFor(booking.visitOn),
      muted: booking.status === "declined",
      booking,
    });
  }
  for (const [day, items] of byDay) byDay.set(day, items.toSorted(byStartTime));
  return byDay;
}
