import { describe, expect, it } from "vitest";
import { parseMytInput, toMytInput } from "./activity-time";

describe("parseMytInput", () => {
  it("reads a typed time as Malaysia time", () => {
    expect(parseMytInput("2026-11-02T09:30")?.toISOString()).toBe(
      "2026-11-02T01:30:00.000Z",
    );
  });

  it("rejects text that is not a date and time", () => {
    expect(parseMytInput("")).toBeNull();
    expect(parseMytInput("2026-11-02")).toBeNull();
    expect(parseMytInput("2026-13-40T09:30")).toBeNull();
  });
});

describe("toMytInput", () => {
  it("shows a stored timestamp in Malaysia time", () => {
    expect(toMytInput("2026-11-02T16:30:00Z")).toBe("2026-11-03T00:30");
  });

  it("round-trips with parseMytInput", () => {
    const stored = parseMytInput("2026-11-02T09:30");
    expect(stored && toMytInput(stored)).toBe("2026-11-02T09:30");
  });
});
