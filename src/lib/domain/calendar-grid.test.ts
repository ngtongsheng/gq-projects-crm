import { expect, test } from "vitest";
import {
  formatMonthTitle,
  monthWeeks,
  shiftMonth,
  startOfWeek,
  weekDays,
} from "./calendar-grid";

test("a month starting on Sunday opens with a week that is almost all October", () => {
  // 1 Nov 2026 is a Sunday: the first row is Monday 26 Oct to Sunday 1 Nov.
  const weeks = monthWeeks("2026-11-15");
  expect(weeks).toHaveLength(6);
  expect(weeks[0]).toEqual([
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
  ]);
  expect(weeks[5][0]).toBe("2026-11-30");
  expect(weeks[5][6]).toBe("2026-12-06");
});

test("February in a leap year includes the 29th", () => {
  const weeks = monthWeeks("2028-02-10");
  expect(weeks).toHaveLength(5);
  expect(weeks[0][0]).toBe("2028-01-31");
  expect(weeks[4]).toContain("2028-02-29");
  expect(weeks[4][6]).toBe("2028-03-05");
});

test("a leap February that starts on Sunday and ends on Sunday fills five rows", () => {
  const weeks = monthWeeks("2032-02-01");
  expect(weeks).toHaveLength(5);
  expect(weeks[0][0]).toBe("2032-01-26");
  expect(weeks[4][6]).toBe("2032-02-29");
});

test("every row has seven consecutive days", () => {
  for (const week of monthWeeks("2027-05-01")) {
    expect(week).toHaveLength(7);
  }
});

test("weeks start on Monday, including when the date is a Sunday", () => {
  expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
  expect(startOfWeek("2026-11-02")).toBe("2026-11-02");
  expect(weekDays("2026-11-04")[6]).toBe("2026-11-08");
});

test("shifts months across year boundaries", () => {
  expect(shiftMonth("2026-12-20", 1)).toBe("2027-01-01");
  expect(shiftMonth("2027-01-31", -1)).toBe("2026-12-01");
  expect(shiftMonth("2026-11-02", 0)).toBe("2026-11-01");
});

test("titles the month in words", () => {
  expect(formatMonthTitle("2026-11-02")).toBe("November 2026");
});
