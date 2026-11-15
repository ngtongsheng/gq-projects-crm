import { describe, expect, it } from "vitest";
import { effectiveSalesTarget } from "./sales-target";

describe("effectiveSalesTarget", () => {
  it("uses the person's own target over the grade's", () => {
    expect(effectiveSalesTarget({ salesTarget: 1_500_000 }, 1_440_000)).toEqual(
      { amount: 1_500_000, source: "own" },
    );
  });

  it("keeps an own target of zero", () => {
    expect(effectiveSalesTarget({ salesTarget: 0 }, 1_440_000)).toEqual({
      amount: 0,
      source: "own",
    });
  });

  it("falls back to the grade without a row or with an empty sales target", () => {
    expect(effectiveSalesTarget(undefined, 960_000)).toEqual({
      amount: 960_000,
      source: "grade",
    });
    expect(effectiveSalesTarget({ salesTarget: null }, 960_000)).toEqual({
      amount: 960_000,
      source: "grade",
    });
  });

  it("has no target without a row or a grade", () => {
    expect(effectiveSalesTarget(undefined, null)).toEqual({
      amount: null,
      source: "none",
    });
  });
});
