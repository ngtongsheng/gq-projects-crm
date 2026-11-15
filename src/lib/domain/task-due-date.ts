import { addDays, type CalendarDate } from "@/lib/format/date";
import { isWorkday, type WorkCalendar } from "./workdays";

/** The date `days` working days after `from`; 0 days is `from` itself (demo: addWorkdays). */
export function addWorkdays(
  from: CalendarDate,
  days: number,
  calendar: WorkCalendar,
): CalendarDate {
  let date = from;
  let left = days;
  while (left > 0) {
    date = addDays(date, 1);
    if (isWorkday(date, calendar)) left--;
  }
  return date;
}
