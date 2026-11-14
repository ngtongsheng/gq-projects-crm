import { describe, expect, it } from "vitest";
import { parseSizes, sizesTotal } from "./enquiry-sizes";

describe("parseSizes", () => {
  it("reads length x width x pieces on each line, however it is punctuated", () => {
    expect(
      parseSizes("1.83x1.5 x 799\n2.2m × 1.35m @ 1,788 pcs; 3 x 2 x 4"),
    ).toEqual([
      { length: 1.83, width: 1.5, pieces: 799 },
      { length: 2.2, width: 1.35, pieces: 1788 },
      { length: 3, width: 2, pieces: 4 },
    ]);
  });

  it("skips lines that are not sizes", () => {
    expect(parseSizes("sizes to follow\n2 x 0 x 5")).toEqual([]);
  });
});

describe("sizesTotal", () => {
  it("adds up pieces and area to 2 decimals", () => {
    expect(sizesTotal("1.83x1.5 x 799\n2.2x1.35 x 799")).toEqual({
      pieces: 1598,
      area: 4566.29,
    });
  });

  it("is null when no line reads", () => {
    expect(sizesTotal("")).toBeNull();
  });
});
