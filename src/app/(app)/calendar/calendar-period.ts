import {
  endOfMonth,
  formatMonthTitle,
  startOfMonth,
  weekDays,
} from "@/lib/domain/calendar-grid";
import { addDays, type CalendarDate, formatDate } from "@/lib/format/date";
import type { CalendarView } from "./calendar-params";

export type CalendarPeriod = {
  /** True when the period is a calendar month, false when it is a Monday-to-Sunday week. */
  isMonth: boolean;
  from: CalendarDate;
  to: CalendarDate;
  title: string;
};

/** The days a tab shows: the month for the Monthly list, the week for Week and Weekly outcomes. */
export function calendarPeriod(
  view: CalendarView,
  date: CalendarDate,
): CalendarPeriod {
  if (view === "list" || view === "month") {
    return {
      isMonth: true,
      from: startOfMonth(date),
      to: endOfMonth(date),
      title: formatMonthTitle(date),
    };
  }
  const days = weekDays(date);
  const from = days[0];
  const to = days[days.length - 1];
  return {
    isMonth: false,
    from,
    to,
    title: `${formatDate(from)} – ${formatDate(to)}`,
  };
}

/** Malaysia-time bounds for filtering timestamps: from the start of `from` up to the start of the day after `to`. */
export function mytWindow(from: CalendarDate, to: CalendarDate) {
  return {
    start: `${from}T00:00:00+08:00`,
    end: `${addDays(to, 1)}T00:00:00+08:00`,
  };
}
