import { describe, expect, it } from "vitest";
import {
  formatPickupNo,
  formatSampleQty,
  movesStillOut,
  pickupShortfalls,
  type Sample,
  sampleTotals,
} from "./samples";

const sample = (
  id: string,
  product: string,
  qty: number,
  moves: Sample["moves"] = [],
): Sample => ({ id, product, qty, unit: "pc", moves });

describe("formatPickupNo", () => {
  it("pads to four digits", () => {
    expect(formatPickupNo(1)).toBe("SR-0001");
    expect(formatPickupNo(12345)).toBe("SR-12345");
  });
});

describe("formatSampleQty", () => {
  it("names the unit in the plural only above one", () => {
    expect(formatSampleQty(1, "pc")).toBe("1 pc");
    expect(formatSampleQty(3, "pc")).toBe("3 pcs");
    expect(formatSampleQty(2, "box")).toBe("2 boxes");
    expect(formatSampleQty(2.5, "m²")).toBe("2.5 m²");
  });
});

describe("movesStillOut", () => {
  it("keeps takings that have not come back; kept and adjust never count", () => {
    const moves = [
      { id: "a", kind: "out", qty: 1, backOn: null },
      { id: "b", kind: "out", qty: 1, backOn: "2026-11-10" },
      { id: "c", kind: "kept", qty: 1, backOn: null },
      { id: "d", kind: "adjust", qty: 4, backOn: null },
    ] as const;
    expect(movesStillOut(moves).map((move) => move.id)).toEqual(["a"]);
  });
});

describe("sampleTotals", () => {
  it("counts SKUs per product, takings out and samples with none left", () => {
    const totals = sampleTotals([
      sample("1", "Vinyl Tile", 0),
      sample("2", "Carpet Tile", 2, [
        { id: "a", kind: "out", qty: 1, backOn: null },
        { id: "b", kind: "out", qty: 1, backOn: null },
      ]),
      sample("3", "Carpet Tile", 1, [
        { id: "c", kind: "out", qty: 1, backOn: "2026-11-10" },
      ]),
    ]);
    expect(totals).toEqual({
      skus: 3,
      perProduct: [
        ["Carpet Tile", 2],
        ["Vinyl Tile", 1],
      ],
      takenOut: 2,
      noneLeft: 1,
    });
  });
});

describe("pickupShortfalls", () => {
  const atBestLink = new Map([
    ["tile", 3],
    ["rug", 1],
  ]);

  it("is empty when Best Link has enough; free rows are not counted", () => {
    expect(
      pickupShortfalls(
        [
          { sampleId: "tile", qty: 3 },
          { sampleId: null, qty: 50 },
        ],
        atBestLink,
      ),
    ).toEqual([]);
  });

  it("adds up a sample on two rows", () => {
    expect(
      pickupShortfalls(
        [
          { sampleId: "tile", qty: 2 },
          { sampleId: "tile", qty: 2 },
          { sampleId: "rug", qty: 1 },
        ],
        atBestLink,
      ),
    ).toEqual([{ sampleId: "tile", asked: 4, atBestLink: 3 }]);
  });

  it("treats a sample no longer in the list as none left", () => {
    expect(
      pickupShortfalls([{ sampleId: "gone", qty: 1 }], atBestLink),
    ).toEqual([{ sampleId: "gone", asked: 1, atBestLink: 0 }]);
  });
});
