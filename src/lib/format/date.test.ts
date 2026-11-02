import { expect, test } from "vitest";
import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatDate,
  formatDateTime,
  todayMyt,
} from "./date";

test("today in Malaysia is ahead of UTC after 16:00 UTC", () => {
  expect(todayMyt(new Date("2026-11-02T15:59:00Z"))).toBe("2026-11-02");
  expect(todayMyt(new Date("2026-11-02T16:00:00Z"))).toBe("2026-11-03");
  expect(todayMyt(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
});

test("adds days across month and year boundaries", () => {
  expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test("handles leap years", () => {
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  expect(daysBetween("2028-02-01", "2028-03-01")).toBe(29);
});

test("counts calendar days between dates, negative when reversed", () => {
  expect(daysBetween("2026-11-02", "2026-11-02")).toBe(0);
  expect(daysBetween("2026-11-02", "2026-11-09")).toBe(7);
  expect(daysBetween("2026-11-09", "2026-11-02")).toBe(-7);
});

test("gives the weekday", () => {
  expect(dayOfWeek("2026-11-02")).toBe(1);
  expect(dayOfWeek("2026-11-01")).toBe(0);
});

test("formats dates and Malaysia date-times", () => {
  expect(formatDate("2026-11-02")).toBe("2 Nov 2026");
  expect(formatDateTime("2026-11-02T01:00:00Z")).toBe("2 Nov 2026, 9:00 AM");
  expect(formatDateTime("2026-11-02T16:30:00Z")).toBe("3 Nov 2026, 12:30 AM");
  expect(formatDateTime("2026-11-02T04:05:00Z")).toBe("2 Nov 2026, 12:05 PM");
});
