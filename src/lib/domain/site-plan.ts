import type { JobStatus, JobType } from "@/lib/domain/delivery-status";
import {
  BOOKING_PURPOSE_LABEL,
  type BookingPurpose,
  type BookingStatus,
} from "@/lib/domain/site-booking";
import {
  type AwayRange,
  type LoggedSiteJob,
  type PlannedSiteJob,
  SITE_ACTIVITY_LABEL,
  type SiteActivity,
  sameSite,
} from "@/lib/domain/site-log";
import { isWorkday } from "@/lib/domain/workdays";
import {
  addDays,
  type CalendarDate,
  earlierDate,
  laterDate,
} from "@/lib/format/date";

export type PlanJob = {
  jobType: JobType;
  status: JobStatus;
  scheduledOn: CalendarDate;
  endsOn: CalendarDate;
  mofId: string;
  mofNo: string;
  projectName: string;
  startTime: string;
  notes: string;
};

export type PlanBooking = {
  purpose: BookingPurpose;
  status: BookingStatus;
  visitOn: CalendarDate;
  startTime: string;
  projectId: string | null;
  /** The pipeline project's name, or the site typed in. */
  siteLabel: string;
  notes: string;
};

/** What the calendar planned for the supervisor on one day, and the activity that records it. */
export type PlannedWork = PlannedSiteJob & {
  activity: SiteActivity;
  /** What to show for the site: "MOF no. · project" or the typed-in site. */
  siteLabel: string;
  what: string;
  note: string;
  startTime: string;
};

const JOB_ACTIVITY: Record<JobType, SiteActivity> = {
  installation: "installation",
  delivery: "delivery",
  site_measurement: "measurement",
};

const BOOKING_ACTIVITY: Record<BookingPurpose, SiteActivity> = {
  site_measurement: "measurement",
  site_inspection: "inspection",
  handover: "handover",
  shooting: "shooting",
  meet_client: "inspection",
  others: "inspection",
};

/**
 * The supervisor's planned work for each day from `from` to `to`: scheduled jobs (a job
 * spanning days is planned on each of them; postponed ones are not) and bookings that are
 * not declined. Earliest day first, then by start time.
 */
export function plannedWork(input: {
  from: CalendarDate;
  to: CalendarDate;
  jobs: readonly PlanJob[];
  bookings: readonly PlanBooking[];
}): PlannedWork[] {
  const planned: PlannedWork[] = [];
  for (const job of input.jobs) {
    if (job.status === "postponed") continue;
    const first = laterDate(job.scheduledOn, input.from);
    const last = earlierDate(job.endsOn, input.to);
    for (let day = first; day <= last; day = addDays(day, 1)) {
      planned.push({
        day,
        mofId: job.mofId,
        projectId: null,
        siteName: null,
        activity: JOB_ACTIVITY[job.jobType],
        siteLabel: `${job.mofNo} · ${job.projectName}`,
        what: SITE_ACTIVITY_LABEL[JOB_ACTIVITY[job.jobType]],
        note: job.notes,
        startTime: job.startTime,
      });
    }
  }
  for (const booking of input.bookings) {
    if (booking.status === "declined") continue;
    if (booking.visitOn < input.from || booking.visitOn > input.to) continue;
    planned.push({
      day: booking.visitOn,
      mofId: null,
      projectId: booking.projectId,
      siteName: booking.projectId ? null : booking.siteLabel,
      activity: BOOKING_ACTIVITY[booking.purpose],
      siteLabel: booking.siteLabel,
      what: BOOKING_PURPOSE_LABEL[booking.purpose],
      note: booking.notes,
      startTime: booking.startTime,
    });
  }
  return planned.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.startTime || "99:99").localeCompare(b.startTime || "99:99"),
  );
}

/** Logged at that site on that day for the planned activity: "Recorded" on the job's card. */
export const isPlannedWorkRecorded = (
  work: PlannedWork,
  logs: readonly (LoggedSiteJob & { activity: SiteActivity })[],
): boolean =>
  logs.some(
    (log) =>
      log.visitedOn === work.day &&
      log.activity === work.activity &&
      sameSite(work, log),
  );

const REMIND_FROM_HOUR = 17;

/**
 * "Before you go home, record today's work": a site day, nothing logged yet, 17:00 or later
 * in Malaysia. Away days and holidays never nag.
 */
export function shouldRemindToLog(input: {
  today: CalendarDate;
  hourMyt: number;
  holidays: ReadonlySet<CalendarDate>;
  away: readonly AwayRange[];
  loggedToday: boolean;
}): boolean {
  return (
    input.hourMyt >= REMIND_FROM_HOUR &&
    !input.loggedToday &&
    isWorkday(input.today, { week: "mon-sat", holidays: input.holidays }) &&
    !input.away.some(
      (off) => off.startsOn <= input.today && input.today <= off.endsOn,
    )
  );
}
