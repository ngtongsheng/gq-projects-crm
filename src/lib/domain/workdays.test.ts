import { expect, test } from "vitest";
import {
  firstMondayOfNextMonth,
  pace,
  workdaysElapsed,
  workdaysInMonth,
} from "./workdays";

test("counts Monday to Friday in a month", () => {
  expect(workdaysInMonth("2026-11-15")).toBe(21);
  expect(workdaysInMonth("2026-02-10")).toBe(20);
});

test("counts February in a leap year", () => {
  expect(workdaysInMonth("2028-02-01")).toBe(21);
});

test("counts elapsed workdays including the given day", () => {
  expect(workdaysElapsed("2026-11-01")).toBe(0);
  expect(workdaysElapsed("2026-11-02")).toBe(1);
  expect(workdaysElapsed("2026-11-08")).toBe(5);
  expect(workdaysElapsed("2026-11-30")).toBe(21);
});

test("pace is the share of workdays elapsed", () => {
  expect(pace("2026-11-01")).toBe(0);
  expect(pace("2026-11-30")).toBe(1);
  expect(pace("2026-11-08")).toBeCloseTo(5 / 21);
});

test("first Monday is the 1st when the 1st is a Monday", () => {
  expect(firstMondayOfNextMonth("2026-05-20")).toBe("2026-06-01");
  expect(firstMondayOfNextMonth("2026-05-31")).toBe("2026-06-01");
});

test("first Monday of next month when the 1st is another weekday", () => {
  expect(firstMondayOfNextMonth("2026-10-20")).toBe("2026-11-02");
  expect(firstMondayOfNextMonth("2026-01-31")).toBe("2026-02-02");
  expect(firstMondayOfNextMonth("2026-09-30")).toBe("2026-10-05");
});

test("first Monday rolls over the year end", () => {
  expect(firstMondayOfNextMonth("2026-12-15")).toBe("2027-01-04");
  expect(firstMondayOfNextMonth("2026-11-30")).toBe("2026-12-07");
});
