import { describe, expect, it } from "vitest";
import { activityDay, lastCompletedDay } from "./last-activity";

describe("activityDay", () => {
  it("uses the Malaysia calendar day", () => {
    expect(activityDay("2026-11-02T17:00:00Z")).toBe("2026-11-03");
    expect(activityDay("2026-11-02T15:59:00Z")).toBe("2026-11-02");
  });
});

describe("lastCompletedDay", () => {
  it("picks the latest completed activity and ignores the rest", () => {
    expect(
      lastCompletedDay([
        { status: "completed", startsAt: "2026-09-01T02:00:00Z" },
        { status: "completed", startsAt: "2026-10-05T02:00:00Z" },
        { status: "planned", startsAt: "2026-11-20T02:00:00Z" },
        { status: "cancelled", startsAt: "2026-10-30T02:00:00Z" },
      ]),
    ).toBe("2026-10-05");
  });

  it("is null when nothing is completed", () => {
    expect(
      lastCompletedDay([
        { status: "planned", startsAt: "2026-11-20T02:00:00Z" },
      ]),
    ).toBeNull();
    expect(lastCompletedDay([])).toBeNull();
  });
});
