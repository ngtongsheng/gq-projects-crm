import { isSameMonth } from "@/lib/domain/calendar-grid";
import {
  SITE_ACTIVITIES,
  SITE_ACTIVITY_LABEL,
  type SiteActivity,
} from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";

/** One line of the site log, with the MOF it was logged against. */
export type ItineraryLog = {
  visitedOn: CalendarDate;
  mofNo: string;
  projectName: string;
  activity: SiteActivity;
  notes: string | null;
  handoverSigned: boolean;
};

/** One overtime claim, with the MOF and who decided it. */
export type OvertimeLine = {
  workDate: CalendarDate;
  mofNo: string;
  projectName: string;
  reason: string;
  /** "HH:MM" */
  fromTime: string;
  toTime: string;
  hours: number;
  status: "pending" | "approved" | "rejected";
  approvedBy: string | null;
};

export type ItineraryRow = {
  no: number;
  date: CalendarDate;
  day: string;
  mofNo: string;
  site: string;
  activity: string;
  details: string;
};

export type SiteMonthlyReport = {
  name: string;
  month: CalendarDate;
  itinerary: ItineraryRow[];
  overtime: (OvertimeLine & { no: number })[];
  overtimeHours: number;
  /** The template's seven activity counts, in its order. */
  summary: { label: string; count: number }[];
  totalActivities: number;
  /** Distinct sites and days: one site on one day counts once, however many activities. */
  siteVisits: number;
  handoversSigned: number;
  shootings: number;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const dayName = (date: CalendarDate): string =>
  DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** The template groups deliveries with "Others", which is the activity the CRM keeps apart. */
const TEMPLATE_ACTIVITIES: { label: string; includes: SiteActivity[] }[] = [
  { label: "Measurement", includes: ["measurement"] },
  { label: "Inspection", includes: ["inspection"] },
  { label: "Installation", includes: ["installation"] },
  { label: "Handover", includes: ["handover"] },
  { label: "Shooting", includes: ["shooting"] },
  { label: "Touch Up", includes: ["touch_up"] },
  { label: "Others", includes: ["delivery", "others"] },
];

// Keeps the compiler honest if an activity is ever added to the site log.
const COVERED = new Set(TEMPLATE_ACTIVITIES.flatMap((row) => row.includes));
for (const activity of SITE_ACTIVITIES) {
  if (!COVERED.has(activity)) {
    throw new Error(
      `Site activity ${activity} has no line in the monthly report`,
    );
  }
}

/**
 * A Site Supervisor's month as the monthly report form lays it out: the itinerary, the overtime
 * record, the activity counts and the headline figures. Rejected overtime is left out. Only the
 * month asked for is used, so callers may pass more.
 */
export function buildSiteMonthlyReport(input: {
  name: string;
  month: CalendarDate;
  logs: readonly ItineraryLog[];
  claims: readonly OvertimeLine[];
}): SiteMonthlyReport {
  const logs = input.logs
    .filter((log) => isSameMonth(log.visitedOn, input.month))
    .toSorted(
      (a, b) =>
        a.visitedOn.localeCompare(b.visitedOn) ||
        a.mofNo.localeCompare(b.mofNo),
    );
  const claims = input.claims
    .filter(
      (claim) =>
        claim.status !== "rejected" && isSameMonth(claim.workDate, input.month),
    )
    .toSorted(
      (a, b) =>
        a.workDate.localeCompare(b.workDate) ||
        a.fromTime.localeCompare(b.fromTime),
    );

  const summary = TEMPLATE_ACTIVITIES.map(({ label, includes }) => ({
    label,
    count: logs.filter((log) => includes.includes(log.activity)).length,
  }));
  // Hours are kept to one decimal; summing tenths avoids float drift.
  const tenths = claims.reduce(
    (total, claim) => total + Math.round(claim.hours * 10),
    0,
  );

  return {
    name: input.name,
    month: input.month,
    itinerary: logs.map((log, index) => ({
      no: index + 1,
      date: log.visitedOn,
      day: dayName(log.visitedOn),
      mofNo: log.mofNo,
      site: log.projectName,
      activity: SITE_ACTIVITY_LABEL[log.activity],
      details: [log.notes, log.handoverSigned ? "Handover signed" : null]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
    })),
    overtime: claims.map((claim, index) => ({ ...claim, no: index + 1 })),
    overtimeHours: tenths / 10,
    summary,
    totalActivities: logs.length,
    siteVisits: new Set(logs.map((log) => `${log.visitedOn}|${log.mofNo}`))
      .size,
    handoversSigned: logs.filter(
      (log) => log.activity === "handover" && log.handoverSigned,
    ).length,
    shootings: logs.filter((log) => log.activity === "shooting").length,
  };
}
