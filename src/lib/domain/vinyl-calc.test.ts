import { describe, expect, it } from "vitest";
import { calculateVinyl, type VinylInput } from "./vinyl-calc";

const input = (overrides: Partial<VinylInput>): VinylInput => ({
  length: 4800,
  width: 2550,
  skirting: 100,
  rollWidth: 2000,
  rollLength: 20,
  sides: { T: true, L: true },
  ...overrides,
});

// Expected values come from running the demo's vyCalc (docs/mockup/gqp-office-demo.html) on the
// same inputs.
describe("calculateVinyl matches the demo", () => {
  it("4800 x 2550 with 100 skirting on two sides: A uses less vinyl, B less rod", () => {
    const result = calculateVinyl(input({}));
    expect(result.coverageLength).toBe(4900);
    expect(result.coverageWidth).toBe(2650);
    expect(result.layoutA).toMatchObject({ drops: 3, weldJoints: 2 });
    expect(result.layoutA.dropLength).toBeCloseTo(2.65, 9);
    expect(result.layoutA.orderLength).toBeCloseTo(7.95, 9);
    expect(result.layoutA.orderArea).toBeCloseTo(15.9, 9);
    expect(result.layoutA.weldingRod).toBeCloseTo(5.3, 9);
    expect(result.layoutA.rolls).toBeCloseTo(0.3975, 9);
    expect(result.layoutB).toMatchObject({ drops: 2, weldJoints: 1 });
    expect(result.layoutB.dropLength).toBeCloseTo(4.9, 9);
    expect(result.layoutB.orderLength).toBeCloseTo(9.8, 9);
    expect(result.layoutB.orderArea).toBeCloseTo(19.6, 9);
    expect(result.layoutB.weldingRod).toBeCloseTo(4.9, 9);
    expect(result.skirtingLength).toBeCloseTo(7.35, 9);
    expect(result.lessVinyl).toBe("A");
    expect(result.lessRod).toBe("B");
  });

  it("6000 x 3000, 75 skirting on all sides, 1800 x 25 roll: B uses less vinyl and rod", () => {
    const result = calculateVinyl(
      input({
        length: 6000,
        width: 3000,
        skirting: 75,
        rollWidth: 1800,
        rollLength: 25,
        sides: { T: true, R: true, B: true, L: true },
      }),
    );
    expect(result.layoutA.drops).toBe(4);
    expect(result.layoutA.orderLength).toBeCloseTo(12.3, 9);
    expect(result.layoutA.orderArea).toBeCloseTo(22.14, 9);
    expect(result.layoutA.weldingRod).toBeCloseTo(9.225, 9);
    expect(result.layoutB.drops).toBe(2);
    expect(result.layoutB.orderLength).toBeCloseTo(12.15, 9);
    expect(result.layoutB.orderArea).toBeCloseTo(21.87, 9);
    expect(result.layoutB.weldingRod).toBeCloseTo(6.075, 9);
    expect(result.layoutB.rolls).toBeCloseTo(0.486, 9);
    expect(result.skirtingLength).toBe(18);
    expect(result.lessVinyl).toBe("B");
    expect(result.lessRod).toBe("B");
  });

  it("3500 x 2000, no skirting: one drop across the width means no weld", () => {
    const result = calculateVinyl(
      input({ length: 3500, width: 2000, skirting: 0, sides: {} }),
    );
    expect(result.layoutA).toMatchObject({ drops: 2, weldJoints: 1 });
    expect(result.layoutB).toMatchObject({
      drops: 1,
      weldJoints: 0,
      weldingRod: 0,
    });
    expect(result.layoutB.orderLength).toBeCloseTo(3.5, 9);
    expect(result.skirtingLength).toBe(0);
    expect(result.lessVinyl).toBe("B");
  });
});

describe("calculateVinyl edge cases", () => {
  it("falls back to a 2000 mm x 20 m roll when none is keyed in", () => {
    const result = calculateVinyl(input({ rollWidth: 0, rollLength: 0 }));
    expect(result.layoutA.drops).toBe(3);
    expect(result.layoutA.rolls).toBeCloseTo(0.3975, 9);
  });

  it("reports no difference when both layouts use the same vinyl", () => {
    const result = calculateVinyl(
      input({ length: 2000, width: 2000, skirting: 0, sides: {} }),
    );
    expect(result.lessVinyl).toBeNull();
    expect(result.lessRod).toBeNull();
  });
});
