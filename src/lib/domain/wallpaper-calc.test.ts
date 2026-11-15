import { describe, expect, it } from "vitest";
import { calculateWallpaper, type WallpaperInput } from "./wallpaper-calc";

const input = (overrides: Partial<WallpaperInput>): WallpaperInput => ({
  type: "Korean",
  wallWidth: 8,
  wallHeight: 2.8,
  allowance: 0.1,
  paperWidth: 0,
  rollLength: 0,
  ...overrides,
});

// Expected values come from running the demo's wpCalc (docs/mockup/gqp-office-demo.html) on the
// same inputs.
describe("calculateWallpaper matches the demo", () => {
  it("Korean, 8 m wall: 8 panels of 2.9 m, 5 per roll, 2 rolls", () => {
    const result = calculateWallpaper(input({}));
    expect(result).toMatchObject({
      sale: "roll",
      width: 1.06,
      rollLength: 15.5,
      panels: 8,
      panelsPerRoll: 5,
      rolls: 2,
    });
    expect(result.cutHeight).toBeCloseTo(2.9, 9);
    expect(result.lengthNeeded).toBeCloseTo(23.2, 9);
    expect(result.area).toBeCloseTo(32.86, 9);
    if (result.sale === "roll") expect(result.offcut).toBeCloseTo(7.8, 9);
  });

  it("European, 5.3 m wall: 10 panels, 4 per roll, 3 rolls", () => {
    const result = calculateWallpaper(
      input({ type: "European", wallWidth: 5.3, wallHeight: 2.4 }),
    );
    expect(result).toMatchObject({
      sale: "roll",
      panels: 10,
      panelsPerRoll: 4,
      rolls: 3,
    });
    expect(result.area).toBeCloseTo(15.9954, 9);
    if (result.sale === "roll") expect(result.offcut).toBeCloseTo(5.18, 9);
  });

  it("Fabric Back is ordered by the running metre: 5 panels x 2.85 = 14.25, order 15 m", () => {
    const result = calculateWallpaper(
      input({
        type: "Fabric Back",
        wallWidth: 6,
        wallHeight: 2.7,
        allowance: 0.15,
      }),
    );
    expect(result).toMatchObject({
      sale: "running-metre",
      width: 1.37,
      panels: 5,
      metres: 15,
    });
    expect(result.lengthNeeded).toBeCloseTo(14.25, 9);
    expect(result.area).toBeCloseTo(20.55, 9);
  });
});

describe("calculateWallpaper edge cases", () => {
  it("uses the product's own width and roll length when keyed in", () => {
    const result = calculateWallpaper(
      input({
        type: "European",
        wallWidth: 4,
        wallHeight: 2.5,
        paperWidth: 0.7,
        rollLength: 12,
      }),
    );
    expect(result).toMatchObject({
      width: 0.7,
      rollLength: 12,
      panels: 6,
      panelsPerRoll: 4,
      rolls: 2,
    });
    expect(result.area).toBeCloseTo(16.8, 9);
  });

  it("has no roll count when one panel is longer than a roll", () => {
    const result = calculateWallpaper(input({ wallWidth: 3, wallHeight: 20 }));
    expect(result).toMatchObject({ panelsPerRoll: 0, rolls: null, area: 0 });
  });

  it("does not add a panel for floating point noise", () => {
    // 0.53 x 3 = 1.59 exactly on paper, 1.5900000000000003 in floating point.
    const result = calculateWallpaper(
      input({ type: "European", wallWidth: 1.59 }),
    );
    expect(result.panels).toBe(3);
  });
});
