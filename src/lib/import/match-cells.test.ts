import { describe, expect, it } from "vitest";
import { matchOption, sheetDate } from "./match-cells";

describe("sheetDate", () => {
  it("reads day-first slash dates, with two or four digit years", () => {
    expect(sheetDate("5/11/2026")).toBe("2026-11-05");
    expect(sheetDate("05/11/26")).toBe("2026-11-05");
  });

  it("leaves ISO dates and other text for the schema to judge", () => {
    expect(sheetDate("2026-11-05")).toBe("2026-11-05");
    expect(sheetDate("next week")).toBe("next week");
    expect(sheetDate("")).toBe("");
  });
});

describe("matchOption", () => {
  const labels = { m2: "m²", roll: "Roll" };

  it("matches the value or the label, ignoring case and punctuation", () => {
    expect(matchOption("M2", ["m2", "roll"], labels)).toBe("m2");
    expect(matchOption("m²", ["m2", "roll"], labels)).toBe("m2");
    expect(matchOption("ROLL", ["m2", "roll"], labels)).toBe("roll");
    expect(matchOption("pail", ["m2", "roll"], labels)).toBeUndefined();
  });
});
