import { describe, expect, it } from "vitest";
import { ClaimSettings, claimMonthOf, claimPeriod } from "./claim-month";

describe("claimMonthOf", () => {
  it("keeps the cut-off day itself in its month", () => {
    expect(claimMonthOf("2026-11-25", 25)).toBe("2026-11-01");
    expect(claimMonthOf("2026-11-01", 25)).toBe("2026-11-01");
  });

  it("rolls the day after the cut-off into the next month", () => {
    expect(claimMonthOf("2026-11-26", 25)).toBe("2026-12-01");
    expect(claimMonthOf("2026-11-30", 25)).toBe("2026-12-01");
  });

  it("rolls late December into January of the next year", () => {
    expect(claimMonthOf("2026-12-25", 25)).toBe("2026-12-01");
    expect(claimMonthOf("2026-12-26", 25)).toBe("2027-01-01");
  });

  it("follows the cut-off day setting", () => {
    expect(claimMonthOf("2026-11-21", 20)).toBe("2026-12-01");
    expect(claimMonthOf("2026-11-28", 28)).toBe("2026-11-01");
  });
});

describe("claimPeriod", () => {
  it("runs from the day after last month's cut-off to this month's", () => {
    expect(claimPeriod("2026-11-01", 25)).toEqual({
      from: "2026-10-26",
      to: "2026-11-25",
    });
  });

  it("starts January's claim in the previous December", () => {
    expect(claimPeriod("2027-01-01", 25)).toEqual({
      from: "2026-12-26",
      to: "2027-01-25",
    });
  });

  it("starts March's claim inside February", () => {
    expect(claimPeriod("2027-03-01", 28)).toEqual({
      from: "2027-03-01",
      to: "2027-03-28",
    });
  });
});

describe("ClaimSettings", () => {
  it("accepts the stored setting, other old keys ignored", () => {
    expect(
      ClaimSettings.safeParse({ cutOffDay: 25, kmPerDay: 150 }).data,
    ).toEqual({ cutOffDay: 25 });
  });

  it("keeps the cut-off day a whole day from 1 to 28", () => {
    expect(ClaimSettings.safeParse({ cutOffDay: 29 }).success).toBe(false);
    expect(ClaimSettings.safeParse({ cutOffDay: 2.5 }).success).toBe(false);
  });
});
