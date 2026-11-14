import { expect, test } from "vitest";
import {
  firstMondayOfNextMonth,
  pace,
  type WorkCalendar,
  weekKindFor,
  workdaysElapsed,
  workdaysInMonth,
} from "./workdays";

const calendar = (
  week: WorkCalendar["week"],
  ...holidays: string[]
): WorkCalendar => ({ week, holidays: new Set(holidays) });

const MON_FRI = calendar("mon-fri");
const MON_SAT = calendar("mon-sat");

test("counts Monday to Friday in a month", () => {
  expect(workdaysInMonth("2026-11-15", MON_FRI)).toBe(21);
  expect(workdaysInMonth("2026-02-10", MON_FRI)).toBe(20);
});

test("counts February in a leap year", () => {
  expect(workdaysInMonth("2028-02-01", MON_FRI)).toBe(21);
});

test("counts elapsed workdays including the given day", () => {
  expect(workdaysElapsed("2026-11-01", MON_FRI)).toBe(0);
  expect(workdaysElapsed("2026-11-02", MON_FRI)).toBe(1);
  expect(workdaysElapsed("2026-11-08", MON_FRI)).toBe(5);
  expect(workdaysElapsed("2026-11-30", MON_FRI)).toBe(21);
});

test("pace is the share of workdays elapsed", () => {
  expect(pace("2026-11-01", MON_FRI)).toBe(0);
  expect(pace("2026-11-30", MON_FRI)).toBe(1);
  expect(pace("2026-11-08", MON_FRI)).toBeCloseTo(5 / 21);
});

test("a Monday to Saturday week counts Saturdays but never Sundays", () => {
  // November 2026 has 30 days and 5 Sundays (1, 8, 15, 22, 29).
  expect(workdaysInMonth("2026-11-15", MON_SAT)).toBe(25);
  expect(workdaysElapsed("2026-11-07", MON_SAT)).toBe(6);
  expect(workdaysElapsed("2026-11-08", MON_SAT)).toBe(6);
  expect(workdaysElapsed("2026-11-09", MON_SAT)).toBe(7);
});

test("a public holiday on a weekday is not a workday", () => {
  const withHoliday = calendar("mon-fri", "2026-12-25"); // a Friday
  expect(workdaysInMonth("2026-12-01", MON_FRI)).toBe(23);
  expect(workdaysInMonth("2026-12-01", withHoliday)).toBe(22);
  expect(workdaysElapsed("2026-12-24", withHoliday)).toBe(18);
  expect(workdaysElapsed("2026-12-25", withHoliday)).toBe(18);
  expect(workdaysElapsed("2026-12-28", withHoliday)).toBe(19);
});

test("a holiday on a Sunday, or a Saturday in a Mon-Fri week, changes nothing", () => {
  expect(workdaysInMonth("2026-11-01", calendar("mon-fri", "2026-11-08"))).toBe(
    21,
  );
  expect(workdaysInMonth("2026-11-01", calendar("mon-fri", "2026-11-07"))).toBe(
    21,
  );
  expect(workdaysInMonth("2026-11-01", calendar("mon-sat", "2026-11-08"))).toBe(
    25,
  );
});

test("a holiday on a Saturday is taken off a Monday to Saturday week", () => {
  expect(workdaysInMonth("2026-11-01", calendar("mon-sat", "2026-11-07"))).toBe(
    24,
  );
});

test("holidays on the last day of a month reach the month's end", () => {
  const monthEnd = calendar("mon-fri", "2026-11-30"); // a Monday
  expect(workdaysInMonth("2026-11-10", monthEnd)).toBe(20);
  expect(workdaysElapsed("2026-11-30", monthEnd)).toBe(20);
  expect(pace("2026-11-30", monthEnd)).toBe(1);
});

test("a holiday in another month is ignored", () => {
  expect(workdaysInMonth("2026-11-10", calendar("mon-fri", "2026-12-25"))).toBe(
    21,
  );
});

test("pace is 0, not NaN, when a month has no workdays", () => {
  const allDays = calendar(
    "mon-fri",
    ...Array.from(
      { length: 30 },
      (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`,
    ),
  );
  expect(pace("2026-11-15", allDays)).toBe(0);
});

test("only site supervisors work Saturdays", () => {
  expect(weekKindFor("site")).toBe("mon-sat");
  expect(weekKindFor("ssup")).toBe("mon-fri");
  expect(weekKindFor("sales")).toBe("mon-fri");
  expect(weekKindFor("md")).toBe("mon-fri");
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
