import { expect, test } from "vitest";
import { calendarPeriod, mytWindow } from "./calendar-period";

test("a week runs Monday to Sunday around any day in it", () => {
  expect(calendarPeriod("week", "2026-11-15")).toEqual({
    isMonth: false,
    from: "2026-11-09",
    to: "2026-11-15",
    title: "9 Nov 2026 – 15 Nov 2026",
  });
  expect(calendarPeriod("outcomes", "2026-11-09").from).toBe("2026-11-09");
});

test("the Monthly list covers exactly the month, not the padded grid", () => {
  expect(calendarPeriod("list", "2026-02-14")).toEqual({
    isMonth: true,
    from: "2026-02-01",
    to: "2026-02-28",
    title: "February 2026",
  });
  expect(calendarPeriod("list", "2028-02-10").to).toBe("2028-02-29");
});

test("the window is Malaysia time and ends before the day after the last day", () => {
  expect(mytWindow("2026-12-28", "2026-12-31")).toEqual({
    start: "2026-12-28T00:00:00+08:00",
    end: "2027-01-01T00:00:00+08:00",
  });
});
