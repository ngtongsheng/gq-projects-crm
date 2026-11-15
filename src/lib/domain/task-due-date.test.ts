import { describe, expect, it } from "vitest";
import { addWorkdays } from "./task-due-date";

const calendar = { week: "mon-fri" as const, holidays: new Set<string>() };

describe("addWorkdays", () => {
  it("keeps the date for zero days", () => {
    expect(addWorkdays("2026-11-16", 0, calendar)).toBe("2026-11-16");
  });

  it("skips the weekend", () => {
    // Thu 19 Nov + 3 working days = Tue 24 Nov
    expect(addWorkdays("2026-11-19", 3, calendar)).toBe("2026-11-24");
  });

  it("skips a public holiday", () => {
    const withHoliday = { ...calendar, holidays: new Set(["2026-11-20"]) };
    expect(addWorkdays("2026-11-19", 1, withHoliday)).toBe("2026-11-23");
  });

  it("starts counting from a weekend date", () => {
    expect(addWorkdays("2026-11-21", 1, calendar)).toBe("2026-11-23");
  });
});
