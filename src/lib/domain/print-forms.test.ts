import { describe, expect, it } from "vitest";
import {
  flooringTypes,
  installationAreaSqft,
  parsePrintForm,
} from "./print-forms";

describe("flooringTypes", () => {
  it("ticks carpet and vinyl from the product names", () => {
    expect(flooringTypes(["Carpet tile Unijoy", "SPC click"])).toEqual({
      carpet: true,
      vinyl: true,
    });
    expect(flooringTypes(["Wallpaper"])).toEqual({
      carpet: false,
      vinyl: false,
    });
  });

  it("matches vinyl by its other names", () => {
    expect(flooringTypes(["LVT plank"]).vinyl).toBe(true);
  });
});

describe("installationAreaSqft", () => {
  it("adds square feet and square metres in square feet", () => {
    expect(
      installationAreaSqft([
        { qty: 1000, unit: "sqft", areaM2: 0 },
        { qty: 10, unit: "m2", areaM2: 0 },
      ]),
    ).toBe(1108);
  });

  it("is empty when no line has an area", () => {
    expect(installationAreaSqft([])).toBeNull();
    expect(
      installationAreaSqft([{ qty: 2, unit: "roll", areaM2: 0 }]),
    ).toBeNull();
  });
});

describe("parsePrintForm", () => {
  it("accepts the three forms only", () => {
    expect(parsePrintForm("handover")).toBe("handover");
    expect(parsePrintForm("quote")).toBeNull();
  });
});
