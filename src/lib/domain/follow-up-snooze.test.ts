import { describe, expect, it } from "vitest";
import {
  currentWait,
  type FollowUpWait,
  isSnoozed,
  snoozeUntil,
} from "./follow-up-snooze";

const siteWeek = { week: "mon-sat" as const, holidays: new Set<string>() };
const officeWeek = { week: "mon-fri" as const, holidays: new Set<string>() };

describe("snoozeUntil", () => {
  it("counts the next working day", () => {
    // Mon 16 Nov 2026
    expect(snoozeUntil("2026-11-16", 1, siteWeek)).toBe("2026-11-17");
  });

  it("skips Sunday for a Monday to Saturday week", () => {
    // Sat 21 Nov + 1 working day: Sunday is off, so Monday
    expect(snoozeUntil("2026-11-21", 1, siteWeek)).toBe("2026-11-23");
    // Fri 20 Nov + 2 working days: Sat, then Mon
    expect(snoozeUntil("2026-11-20", 2, siteWeek)).toBe("2026-11-23");
  });

  it("skips the whole weekend for a Monday to Friday week", () => {
    expect(snoozeUntil("2026-11-20", 1, officeWeek)).toBe("2026-11-23");
  });

  it("skips public holidays", () => {
    const holiday = { ...siteWeek, holidays: new Set(["2026-11-17"]) };
    expect(snoozeUntil("2026-11-16", 1, holiday)).toBe("2026-11-18");
  });

  it("counts five working days across a Sunday and a holiday", () => {
    const holiday = { ...siteWeek, holidays: new Set(["2026-11-18"]) };
    // Mon 16: Tue 17, (Wed 18 off), Thu 19, Fri 20, Sat 21, (Sun off), Mon 23
    expect(snoozeUntil("2026-11-16", 5, holiday)).toBe("2026-11-23");
  });
});

const wait = (snoozedUntil: string, createdAt: string): FollowUpWait => ({
  note: "Waiting for stock",
  snoozedUntil,
  createdAt,
});

describe("currentWait", () => {
  it("is null with no waits", () => {
    expect(currentWait([])).toBeNull();
  });

  it("takes the latest entry, however the rows are ordered", () => {
    const newest = wait("2026-11-25", "2026-11-18T09:00:00Z");
    const older = wait("2026-11-30", "2026-11-16T09:00:00Z");
    expect(currentWait([newest, older])).toBe(newest);
    expect(currentWait([older, newest])).toBe(newest);
  });
});

describe("isSnoozed", () => {
  it("holds the follow-up back until the snooze day", () => {
    const held = wait("2026-11-18", "2026-11-16T09:00:00Z");
    expect(isSnoozed(held, "2026-11-17")).toBe(true);
    expect(isSnoozed(held, "2026-11-18")).toBe(false);
  });

  it("is not snoozed with no wait", () => {
    expect(isSnoozed(null, "2026-11-17")).toBe(false);
  });
});
