import {
  endOfMonth,
  isSameMonth,
  startOfMonth,
} from "@/lib/domain/calendar-grid";
import { leaveDays } from "@/lib/domain/leave-balance";
import { countSiteVisits, type SiteActivity } from "@/lib/domain/site-log";
import type { WorkCalendar } from "@/lib/domain/workdays";
import type { CalendarDate } from "@/lib/format/date";

export type TallyLog = {
  supervisorId: string;
  mofId: string | null;
  siteName: string | null;
  visitedOn: CalendarDate;
  activity: SiteActivity;
  handoverSigned: boolean;
};

export type MonthTally = {
  visits: number;
  shootings: number;
  /** Handover forms signed, the figure counted against the handover target. */
  handovers: number;
  stockReturns: number;
};

/** One supervisor's month on the Site log tab: the figures that sit beside their targets. */
export function monthTally(
  logs: readonly TallyLog[],
  supervisorId: string,
  month: CalendarDate,
): MonthTally {
  const mine = logs.filter(
    (log) =>
      log.supervisorId === supervisorId && isSameMonth(log.visitedOn, month),
  );
  const count = (match: (log: TallyLog) => boolean) =>
    mine.filter(match).length;
  return {
    visits: countSiteVisits(mine, month),
    shootings: count((log) => log.activity === "shooting"),
    handovers: count(
      (log) => log.activity === "handover" && log.handoverSigned,
    ),
    stockReturns: count((log) => log.activity === "stock_return"),
  };
}

/** Days away in a month, by what kind: working days only, clipped to the month. */
export function awayDaysByKind(
  away: readonly {
    kind: string;
    startsOn: CalendarDate;
    endsOn: CalendarDate;
  }[],
  month: CalendarDate,
  calendar: WorkCalendar,
): Map<string, number> {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const days = new Map<string, number>();
  for (const entry of away) {
    const startsOn = entry.startsOn > first ? entry.startsOn : first;
    const endsOn = entry.endsOn < last ? entry.endsOn : last;
    if (startsOn > endsOn) continue;
    const count = leaveDays(startsOn, endsOn, false, calendar);
    if (count > 0) days.set(entry.kind, (days.get(entry.kind) ?? 0) + count);
  }
  return days;
}
