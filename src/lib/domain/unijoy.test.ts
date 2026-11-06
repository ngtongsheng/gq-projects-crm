import { describe, expect, it } from "vitest";
import { isUnijoy, unijoyM2, unijoyProgress, unijoyTargetFor } from "./unijoy";

const line = (
  supplier: string | null,
  qty: number,
  unit: "m2" | "sqft" | "roll" | "pcs" = "m2",
  areaM2 = 0,
) => ({ supplier, qty, unit, areaM2 });

describe("isUnijoy", () => {
  it("matches Unijoy however it is typed", () => {
    expect(isUnijoy("Unijoy")).toBe(true);
    expect(isUnijoy("  unijoy ")).toBe(true);
    expect(isUnijoy("UNIJOY")).toBe(true);
  });

  it("does not match other suppliers or none", () => {
    expect(isUnijoy("Unijoy Trading")).toBe(false);
    expect(isUnijoy("Floor Place")).toBe(false);
    expect(isUnijoy("")).toBe(false);
    expect(isUnijoy(null)).toBe(false);
  });
});

describe("unijoyM2", () => {
  it("adds the m² of the Unijoy lines only", () => {
    expect(
      unijoyM2([
        line("Unijoy", 100),
        line("Floor Place", 500),
        line(null, 40),
        line("unijoy", 50),
      ]),
    ).toBe(150);
  });

  it("turns sqft into m² and uses the keyed area for rolls and pieces", () => {
    expect(
      unijoyM2([line("Unijoy", 500, "sqft"), line("Unijoy", 3, "roll", 60)]),
    ).toBeCloseTo(46.45 + 60, 1);
  });

  it("is zero with no Unijoy lines", () => {
    expect(unijoyM2([line("Floor Place", 900)])).toBe(0);
    expect(unijoyM2([])).toBe(0);
  });
});

describe("unijoyProgress", () => {
  it("works out the share reached and what is left", () => {
    expect(unijoyProgress(22097, 25000)).toEqual({
      m2: 22097,
      target: 25000,
      pct: 88,
      remaining: 2903,
    });
  });

  it("can pass the target, with nothing left", () => {
    expect(unijoyProgress(26000, 25000)).toMatchObject({
      pct: 104,
      remaining: 0,
    });
  });

  it("is null without a target", () => {
    expect(unijoyProgress(100, null)).toBeNull();
    expect(unijoyProgress(100, 0)).toBeNull();
  });
});

describe("unijoyTargetFor", () => {
  const setting = { "2026": 25000, "2027": 30000, "2028": "lots" };

  it("reads the year's target", () => {
    expect(unijoyTargetFor(setting, 2026)).toBe(25000);
    expect(unijoyTargetFor(setting, 2027)).toBe(30000);
  });

  it("is null for a year with none, a bad value or a bad setting", () => {
    expect(unijoyTargetFor(setting, 2029)).toBeNull();
    expect(unijoyTargetFor(setting, 2028)).toBeNull();
    expect(unijoyTargetFor(null, 2026)).toBeNull();
    expect(unijoyTargetFor("25000", 2026)).toBeNull();
  });
});
