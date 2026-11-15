import { isSameMonth } from "@/lib/domain/calendar-grid";
import { SITE_ACTIVITY_LABEL, type SiteActivity } from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";

/** A logged site visit with the order it was for. */
export type ReportSiteLog = {
  mofId: string;
  /** The pipeline project the order came from; how a log is matched to a booking. */
  projectId: string | null;
  siteLabel: string;
  visitedOn: CalendarDate;
  activity: SiteActivity;
  handoverSigned: boolean;
  driveLink: string | null;
};

/** A booking the supervisor confirmed: the day was scheduled for them. */
export type ReportBooking = {
  projectId: string | null;
  siteLabel: string;
  visitOn: CalendarDate;
  purposeLabel: string;
};

/**
 * as_planned: booked and logged. added: logged with no booking. not_logged: booked, the
 * day has passed, nothing logged. upcoming: booked, day not yet here.
 */
export type ItineraryOrigin =
  | "as_planned"
  | "added"
  | "not_logged"
  | "upcoming";

export type ItineraryLine = {
  day: CalendarDate;
  siteLabel: string;
  /** Activity labels logged there, or the booked purpose when nothing was logged. */
  work: string[];
  origin: ItineraryOrigin;
};

export type ItineraryCounts = {
  /** Sites visited: one per site per day, as in the report's site-visit figure. */
  visits: number;
  scheduled: number;
  asPlanned: number;
  added: number;
  notLogged: number;
};

export type Itinerary = { lines: ItineraryLine[]; counts: ItineraryCounts };

// A booking matches a log by project when both have one; a log on an order with no project
// and a typed-in site cannot be matched and counts as added.
const bookingKey = (day: CalendarDate, booking: ReportBooking) =>
  `${day}|${booking.projectId ? `p:${booking.projectId}` : `s:${booking.siteLabel}`}`;
const logKey = (log: ReportSiteLog) =>
  `${log.visitedOn}|${log.projectId ? `p:${log.projectId}` : `m:${log.mofId}`}`;

/**
 * One line per site per day for the month, in date order, with whether each was scheduled
 * or added on the day. `logs` and `bookings` must already be this supervisor's.
 */
export function buildItinerary(input: {
  month: CalendarDate;
  today: CalendarDate;
  logs: readonly ReportSiteLog[];
  bookings: readonly ReportBooking[];
}): Itinerary {
  const lines = new Map<string, ItineraryLine>();
  const booked = new Map<string, ReportBooking[]>();
  for (const booking of input.bookings) {
    if (!isSameMonth(booking.visitOn, input.month)) continue;
    const key = bookingKey(booking.visitOn, booking);
    booked.set(key, [...(booked.get(key) ?? []), booking]);
  }

  for (const log of input.logs) {
    if (!isSameMonth(log.visitedOn, input.month)) continue;
    const key = logKey(log);
    const label = SITE_ACTIVITY_LABEL[log.activity];
    const line = lines.get(key);
    if (line) {
      if (!line.work.includes(label)) line.work.push(label);
      continue;
    }
    lines.set(key, {
      day: log.visitedOn,
      siteLabel: log.siteLabel,
      work: [label],
      origin: booked.has(key) ? "as_planned" : "added",
    });
  }

  for (const [key, group] of booked) {
    if (lines.has(key)) continue;
    const [first] = group;
    if (!first) continue;
    lines.set(key, {
      day: first.visitOn,
      siteLabel: first.siteLabel,
      work: [...new Set(group.map((booking) => booking.purposeLabel))],
      origin: first.visitOn > input.today ? "upcoming" : "not_logged",
    });
  }

  const sorted = [...lines.values()].sort(
    (a, b) =>
      a.day.localeCompare(b.day) || a.siteLabel.localeCompare(b.siteLabel),
  );
  const count = (...origins: ItineraryOrigin[]) =>
    sorted.filter((line) => origins.includes(line.origin)).length;
  return {
    lines: sorted,
    counts: {
      visits: count("as_planned", "added"),
      scheduled: count("as_planned", "not_logged", "upcoming"),
      asPlanned: count("as_planned"),
      added: count("added"),
      notLogged: count("not_logged"),
    },
  };
}

export type ShootingHandoverRow = {
  day: CalendarDate;
  siteLabel: string;
  activity: "shooting" | "handover";
  /** Handover: form signed. Shooting: a link to the finished photos or video is saved. */
  done: boolean;
};

/** Every shooting and handover logged in the month, for the shooting and handover table. */
export function shootingHandoverRows(
  logs: readonly ReportSiteLog[],
  month: CalendarDate,
): ShootingHandoverRow[] {
  const rows: ShootingHandoverRow[] = [];
  for (const log of logs) {
    if (!isSameMonth(log.visitedOn, month)) continue;
    if (log.activity === "handover") {
      rows.push({
        day: log.visitedOn,
        siteLabel: log.siteLabel,
        activity: "handover",
        done: log.handoverSigned,
      });
    } else if (log.activity === "shooting") {
      rows.push({
        day: log.visitedOn,
        siteLabel: log.siteLabel,
        activity: "shooting",
        done: log.driveLink !== null,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.day.localeCompare(b.day) || a.siteLabel.localeCompare(b.siteLabel),
  );
}

/** The words for a row of the shooting and handover table. */
export function shootingHandoverWords(row: ShootingHandoverRow): {
  work: string;
  result: string;
} {
  return row.activity === "handover"
    ? { work: "Handover", result: row.done ? "Form signed" : "Not signed" }
    : {
        work: "Photo / video shooting",
        result: row.done ? "Link saved" : "No link yet",
      };
}

/** The leftover-stock sentence under the stock returns heading. */
export function stockReturnSummary(counts: StockReturnCounts): string {
  return counts.recorded === 0
    ? "No leftover stock recorded this month."
    : `${counts.recorded} leftover items recorded: ${counts.toSupplier} back to the supplier, ${counts.keptByGq} kept by GQ, ${counts.pendingPickup} waiting for pickup.`;
}

/** The schedule check sentence under the itinerary heading. */
export function scheduleCheckSummary(counts: ItineraryCounts): string {
  return `Schedule check: ${counts.scheduled} scheduled, ${counts.asPlanned} done as scheduled, ${counts.added} added on the day, ${counts.notLogged} scheduled but not logged.`;
}

export type StockReturnCounts = {
  /** Leftover items the supervisor recorded in the month. */
  recorded: number;
  /** Of those, going back to the supplier for a credit note. */
  toSupplier: number;
  /** Of those, kept by GQ at Best Link. */
  keptByGq: number;
  /** Of those, still waiting for pickup. */
  pendingPickup: number;
};

export function stockReturnCounts(
  leftovers: readonly {
    destination: "supplier" | "gq";
    status: string;
  }[],
): StockReturnCounts {
  return {
    recorded: leftovers.length,
    toSupplier: leftovers.filter((item) => item.destination === "supplier")
      .length,
    keptByGq: leftovers.filter((item) => item.destination === "gq").length,
    pendingPickup: leftovers.filter((item) => item.status === "pending_pickup")
      .length,
  };
}

/** Everything the site report shows beyond the headline figures. */
export type SiteReport = {
  itinerary: Itinerary;
  shootingHandover: ShootingHandoverRow[];
  stockReturns: StockReturnCounts;
};

export const ORIGIN_LABEL: Record<ItineraryOrigin, string> = {
  as_planned: "As scheduled",
  added: "Added on the day",
  not_logged: "Scheduled, not logged",
  upcoming: "Scheduled",
};
