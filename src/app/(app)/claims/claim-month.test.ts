import { describe, expect, it } from "vitest";
import { travelClaimMonthLabel, travelClaimMonths } from "./claim-month";

describe("travelClaimMonths", () => {
  it("starts at today's claim month and goes back five", () => {
    expect(travelClaimMonths("2026-11-17", 25)).toEqual([
      "2026-11-01",
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
      "2026-07-01",
      "2026-06-01",
    ]);
  });

  it("keeps the 25th in this month and rolls the 26th into the next", () => {
    expect(travelClaimMonths("2026-11-25", 25)[0]).toBe("2026-11-01");
    expect(travelClaimMonths("2026-11-26", 25)[0]).toBe("2026-12-01");
  });

  it("rolls December's days after the cut-off into January and crosses the year back", () => {
    expect(travelClaimMonths("2026-12-26", 25)).toEqual([
      "2027-01-01",
      "2026-12-01",
      "2026-11-01",
      "2026-10-01",
      "2026-09-01",
      "2026-08-01",
    ]);
    expect(travelClaimMonths("2027-02-10", 25).slice(0, 3)).toEqual([
      "2027-02-01",
      "2027-01-01",
      "2026-12-01",
    ]);
  });

  it("follows a changed cut-off day", () => {
    expect(travelClaimMonths("2026-11-21", 20)[0]).toBe("2026-12-01");
  });
});

describe("travelClaimMonthLabel", () => {
  it("shows the month and the days it covers", () => {
    expect(travelClaimMonthLabel("2026-11-01", 25)).toBe(
      "Nov 2026 (26 Oct – 25 Nov)",
    );
  });

  it("starts the first claim month of the year on 26 December", () => {
    expect(travelClaimMonthLabel("2027-01-01", 25)).toBe(
      "Jan 2027 (26 Dec – 25 Jan)",
    );
  });
});
