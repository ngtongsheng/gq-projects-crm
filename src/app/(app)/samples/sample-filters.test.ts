import { describe, expect, it } from "vitest";
import { ALL, filterSamples } from "./sample-filters";
import type { SampleRow } from "./samples-data";

const sample = (fields: Partial<SampleRow>): SampleRow => ({
  id: "x",
  product: "Carpet Tile",
  brand: "Unijoy",
  sku: "",
  name: "",
  qty: 1,
  unit: "pc",
  spec: "",
  notes: "",
  updatedAt: "2026-11-01T00:00:00Z",
  updatedBy: null,
  moves: [],
  ...fields,
});

const list = [
  sample({ id: "a", sku: "XCH-03", name: "Dawn to Dust" }),
  sample({
    id: "b",
    sku: "LST-12",
    name: "Lust",
    brand: "Other",
    product: "SPC",
  }),
  sample({ id: "c", sku: "ZZ-1", notes: "Rack B2" }),
];

const ids = (rows: SampleRow[]) => rows.map((row) => row.id);

describe("filterSamples", () => {
  it("searches SKU, name, brand, product and notes", () => {
    const all = { product: ALL, brand: ALL };
    expect(ids(filterSamples(list, { ...all, query: "dawn" }))).toEqual(["a"]);
    expect(ids(filterSamples(list, { ...all, query: "xch-03" }))).toEqual([
      "a",
    ]);
    expect(ids(filterSamples(list, { ...all, query: "rack" }))).toEqual(["c"]);
    expect(ids(filterSamples(list, { ...all, query: "spc" }))).toEqual(["b"]);
  });

  it("narrows by product and brand together", () => {
    expect(
      ids(filterSamples(list, { query: "", product: "SPC", brand: "Other" })),
    ).toEqual(["b"]);
    expect(
      ids(filterSamples(list, { query: "", product: "SPC", brand: "Unijoy" })),
    ).toEqual([]);
  });
});
