import { describe, expect, it } from "vitest";
import { awayEvents, parseMonthParam } from "./leave-month";

describe("parseMonthParam", () => {
  it("reads a month and falls back to the current one", () => {
    expect(parseMonthParam("2027-03", "2026-11-15")).toBe("2027-03-01");
    expect(parseMonthParam("2027-13", "2026-11-15")).toBe("2026-11-01");
    expect(parseMonthParam("soon", "2026-11-15")).toBe("2026-11-01");
    expect(parseMonthParam(undefined, "2026-11-15")).toBe("2026-11-01");
    expect(parseMonthParam(["2027-03"], "2026-11-15")).toBe("2026-11-01");
  });
});

describe("awayEvents", () => {
  it("puts the holiday before the people away and marks half days", () => {
    const events = awayEvents(
      new Map([
        [
          "2027-12-25",
          [
            {
              personId: "a",
              leaveType: "annual" as const,
              halfDay: "pm" as const,
            },
          ],
        ],
      ]),
      new Map([["2027-12-25", "Christmas Day"]]),
      () => "Anna",
      "/leave",
    );
    expect(events.get("2027-12-25")?.map((e) => [e.title, e.time])).toEqual([
      ["Christmas Day", "Public holiday"],
      ["Anna", "PM"],
    ]);
  });

  it("keeps a holiday nobody is away on", () => {
    const events = awayEvents(
      new Map(),
      new Map([["2027-01-01", "New Year"]]),
      () => "",
      "/leave",
    );
    expect(events.get("2027-01-01")).toHaveLength(1);
  });
});
