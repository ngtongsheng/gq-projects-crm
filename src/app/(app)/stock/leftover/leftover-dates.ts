import {
  type CalendarDate,
  daysBetween,
  formatDate,
  todayMyt,
} from "@/lib/format/date";

/** The Malaysian calendar day a saved timestamp falls on. */
export const dayOf = (timestamp: string): CalendarDate =>
  todayMyt(new Date(timestamp));

export const formatDay = (timestamp: string) => formatDate(dayOf(timestamp));

/** Whole days since it reached Best Link ("At Best Link since"). */
export const daysSince = (timestamp: string, today: CalendarDate) =>
  Math.max(0, daysBetween(dayOf(timestamp), today));
