import { describe, expect, it } from "vitest";
import {
  planSampleImport,
  sampleImportPayload,
  sampleKey,
} from "./sample-import";

const HEADER = "Product\tBrand\tSKU\tProduct name\tQty\tUnit\tSize";
const listed = new Map([
  [
    sampleKey({ brand: "Unijoy", sku: "XCH-03", name: "Dawn to Dust" }),
    { id: "sample-1", unit: "box" as const },
  ],
]);

describe("planSampleImport", () => {
  it("adds a new sample with its SKU in capitals", () => {
    const plan = planSampleImport(
      `${HEADER}\nCarpet Tile\tUnijoy\txch-04\tDusk\t2\tboxes\t50×50cm`,
      "skip",
      { samples: listed },
    );
    expect(plan.rows[0].action).toBe("add");
    expect(sampleImportPayload(plan)).toEqual([
      {
        product: "Carpet Tile",
        brand: "Unijoy",
        sku: "XCH-04",
        name: "Dusk",
        qty: 2,
        unit: "box",
        spec: "50×50cm",
        notes: null,
      },
    ]);
  });

  it("matches a listed sample by brand and SKU whatever the case", () => {
    const plan = planSampleImport(
      `${HEADER}\nCarpet Tile\tunijoy\txch-03\t\t4\t\t`,
      "update",
      { samples: listed },
    );
    expect(plan.rows[0].action).toBe("update");
    expect(plan.rows[0].existingId).toBe("sample-1");
  });

  it("updates only the pasted columns and never the unit", () => {
    const plan = planSampleImport(
      "Product\tSKU\tBrand\tQty\nCarpet Tile\tXCH-03\tUnijoy\t7",
      "update",
      { samples: listed },
    );
    expect(sampleImportPayload(plan)).toEqual([
      {
        id: "sample-1",
        product: "Carpet Tile",
        brand: "Unijoy",
        sku: "XCH-03",
        qty: 7,
      },
    ]);
  });

  it("refuses another unit for a listed sample", () => {
    const plan = planSampleImport(
      `${HEADER}\nCarpet Tile\tUnijoy\tXCH-03\t\t1\tpc\t`,
      "update",
      { samples: listed },
    );
    expect(plan.rows[0].action).toBe("invalid");
    expect(plan.rows[0].errors[0]).toMatch(/counted in box/);
  });

  it("refuses a blank quantity and a row with neither SKU nor name", () => {
    const plan = planSampleImport(
      `${HEADER}\nSPC\tBrand\tAB-1\t\t\tpc\t\nSPC\tBrand\t\t\t1\tpc\t`,
      "skip",
      { samples: listed },
    );
    expect(plan.rows.map((row) => row.errors)).toEqual([
      ["Enter the quantity."],
      ["Key in the SKU or the product name."],
    ]);
  });

  it("reads m2 and catalogues as units", () => {
    const plan = planSampleImport(
      `${HEADER}\nWallpaper\tB\tW-1\t\t1\tm2\t\nWallpaper\tB\tW-2\t\t3\tcatalogues\t`,
      "skip",
      { samples: listed },
    );
    expect(sampleImportPayload(plan).map((row) => row.unit)).toEqual([
      "m²",
      "catalogue",
    ]);
  });
});
