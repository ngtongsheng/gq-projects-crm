import { expect, test } from "vitest";
import { calendarHref, parseCalendarParams, stepDate } from "./calendar-params";

const TODAY = "2026-11-02";
const ARUN = "22222222-2222-4222-8222-222222222222";

test("defaults to this month, everyone, no dialog", () => {
  expect(parseCalendarParams({}, TODAY)).toEqual({
    view: "month",
    date: TODAY,
    who: undefined,
    add: undefined,
    call: undefined,
  });
});

test("the default tab is the caller's choice, and an unknown one falls back to it", () => {
  expect(parseCalendarParams({}, TODAY, "week").view).toBe("week");
  expect(parseCalendarParams({ view: "year" }, TODAY, "week").view).toBe(
    "week",
  );
  expect(parseCalendarParams({ view: "list" }, TODAY, "week").view).toBe(
    "list",
  );
  expect(parseCalendarParams({ view: "outcomes" }, TODAY).view).toBe(
    "outcomes",
  );
});

test("reads a call day and ignores one that is not a real date", () => {
  expect(parseCalendarParams({ call: "2026-12-03" }, TODAY).call).toBe(
    "2026-12-03",
  );
  expect(parseCalendarParams({ call: "2026-13-03" }, TODAY).call).toBe(
    undefined,
  );
});

test("reads a valid week, date, person and add day", () => {
  expect(
    parseCalendarParams(
      { view: "week", date: "2026-12-01", who: ARUN, add: "2026-12-03" },
      TODAY,
    ),
  ).toEqual({ view: "week", date: "2026-12-01", who: ARUN, add: "2026-12-03" });
});

test("ignores values that are not a view, a real date or a person", () => {
  expect(
    parseCalendarParams(
      { view: "year", date: "2026-02-30", who: "arun", add: "tomorrow" },
      TODAY,
    ),
  ).toEqual({ view: "month", date: TODAY, who: undefined, add: undefined });
});

test("steps a month in the Monthly list and a week in the other tabs", () => {
  expect(stepDate("list", "2026-11-20", 1)).toBe("2026-12-01");
  expect(stepDate("outcomes", "2026-11-02", -1)).toBe("2026-10-26");
});

test("steps a month or a week", () => {
  expect(stepDate("month", "2026-12-20", 1)).toBe("2027-01-01");
  expect(stepDate("month", "2026-11-20", -1)).toBe("2026-10-01");
  expect(stepDate("week", "2026-11-02", 1)).toBe("2026-11-09");
  expect(stepDate("week", "2026-11-02", -1)).toBe("2026-10-26");
});

test("links keep what is set and leave month view and everyone out", () => {
  expect(calendarHref({})).toBe("/calendar");
  expect(calendarHref({ view: "week", date: "2026-11-02", who: ARUN })).toBe(
    `/calendar?view=week&date=2026-11-02&who=${ARUN}`,
  );
  expect(calendarHref({ view: "month", date: "2026-11-02" })).toBe(
    "/calendar?date=2026-11-02",
  );
});

test("links leave out the default tab and keep any other", () => {
  expect(calendarHref({ view: "week" }, "/calendar", "week")).toBe("/calendar");
  expect(
    calendarHref({ view: "list", call: "2026-11-02" }, "/calendar", "week"),
  ).toBe("/calendar?view=list&call=2026-11-02");
});

test("links can point at another calendar page", () => {
  expect(
    calendarHref({ view: "week", date: "2026-11-02" }, "/installation"),
  ).toBe("/installation?view=week&date=2026-11-02");
  expect(calendarHref({}, "/installation")).toBe("/installation");
});
