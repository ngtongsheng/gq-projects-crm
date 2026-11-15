import { describe, expect, it } from "vitest";
import { dayOf, daysSince, formatDay } from "./leftover-dates";

describe("leftover dates", () => {
  it("reads a timestamp as the Malaysian day, not the UTC day", () => {
    expect(dayOf("2026-11-14T17:30:00Z")).toBe("2026-11-15");
    expect(formatDay("2026-11-14T17:30:00Z")).toBe("15 Nov 2026");
  });

  it("counts whole days since it arrived, never below zero", () => {
    expect(daysSince("2026-11-05T02:00:00Z", "2026-11-15")).toBe(10);
    expect(daysSince("2026-11-20T02:00:00Z", "2026-11-15")).toBe(0);
  });
});
