import { z } from "zod";
import { shiftMonth } from "@/lib/domain/calendar-grid";
import { addDays, type CalendarDate, todayMyt } from "@/lib/format/date";

const isRealDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;

const calendarDate = z.string().refine(isRealDate);

/**
 * "month" and "week" are the grids (installation); "list" and "outcomes" are the sales
 * calendar's Monthly list and Weekly outcomes tabs.
 */
const calendarView = z.enum(["month", "week", "list", "outcomes"]);
export type CalendarView = z.infer<typeof calendarView>;

// Anything unrecognised falls back to the default, so a hand-edited link never errors.
const calendarParams = z.object({
  view: calendarView.optional().catch(undefined),
  date: calendarDate.optional().catch(undefined),
  who: z.uuid().optional().catch(undefined),
  add: calendarDate.optional().catch(undefined),
  call: calendarDate.optional().catch(undefined),
});

export type CalendarParams = {
  view: CalendarView;
  /** A day inside the month or week being shown. */
  date: CalendarDate;
  /** Whose activities to show; undefined means everyone. */
  who?: string;
  /** The day an "add activity" dialog is open for, if any. */
  add?: CalendarDate;
  /** The day a "Plan a call" dialog is open for, if any. */
  call?: CalendarDate;
};

export function parseCalendarParams(
  params: Record<string, string | string[] | undefined>,
  today: CalendarDate = todayMyt(),
  defaultView: CalendarView = "month",
): CalendarParams {
  const parsed = calendarParams.parse({
    view: params.view,
    date: params.date,
    who: params.who,
    add: params.add,
    call: params.call,
  });
  return {
    ...parsed,
    view: parsed.view ?? defaultView,
    date: parsed.date ?? today,
  };
}

/** Builds a link that keeps the view and person filter and changes the rest. The default view stays out of the link. */
export function calendarHref(
  params: Partial<CalendarParams>,
  path = "/calendar",
  defaultView: CalendarView = "month",
): string {
  const query = new URLSearchParams();
  if (params.view && params.view !== defaultView)
    query.set("view", params.view);
  if (params.date) query.set("date", params.date);
  if (params.who) query.set("who", params.who);
  if (params.add) query.set("add", params.add);
  if (params.call) query.set("call", params.call);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** The date one step back or forward: a month in the month views, seven days in the week views. */
export function stepDate(
  view: CalendarView,
  date: CalendarDate,
  direction: 1 | -1,
): CalendarDate {
  return view === "month" || view === "list"
    ? shiftMonth(date, direction)
    : addDays(date, 7 * direction);
}
