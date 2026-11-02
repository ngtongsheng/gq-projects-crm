import { z } from "zod";
import { shiftMonth } from "@/lib/domain/calendar-grid";
import { addDays, type CalendarDate, todayMyt } from "@/lib/format/date";

const isRealDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

const calendarDate = z.string().refine(isRealDate);

// Anything unrecognised falls back to the default, so a hand-edited link never errors.
const calendarParams = z.object({
  view: z.enum(["month", "week"]).catch("month"),
  date: calendarDate.optional().catch(undefined),
  who: z.uuid().optional().catch(undefined),
  add: calendarDate.optional().catch(undefined),
});

export type CalendarParams = {
  view: "month" | "week";
  /** A day inside the month or week being shown. */
  date: CalendarDate;
  /** Whose activities to show; undefined means everyone. */
  who?: string;
  /** The day an "add activity" dialog is open for, if any. */
  add?: CalendarDate;
};

export function parseCalendarParams(
  params: Record<string, string | string[] | undefined>,
  today: CalendarDate = todayMyt(),
): CalendarParams {
  const parsed = calendarParams.parse({
    view: params.view,
    date: params.date,
    who: params.who,
    add: params.add,
  });
  return { ...parsed, date: parsed.date ?? today };
}

/** Builds a link that keeps the view and person filter and changes the rest. */
export function calendarHref(params: Partial<CalendarParams>): string {
  const query = new URLSearchParams();
  if (params.view && params.view !== "month") query.set("view", params.view);
  if (params.date) query.set("date", params.date);
  if (params.who) query.set("who", params.who);
  if (params.add) query.set("add", params.add);
  const text = query.toString();
  return text ? `/calendar?${text}` : "/calendar";
}

/** The date one step back or forward: a month in month view, seven days in week view. */
export function stepDate(
  view: CalendarParams["view"],
  date: CalendarDate,
  direction: 1 | -1,
): CalendarDate {
  return view === "month"
    ? shiftMonth(date, direction)
    : addDays(date, 7 * direction);
}
