import { describe, expect, it } from "vitest";
import {
  lineAreaM2,
  needsSupplierPo,
  orderTotal,
  totalAreaM2,
} from "./mof-totals";

describe("orderTotal", () => {
  it("adds variation orders to the contract sum on cents", () => {
    expect(orderTotal({ contractSum: 0.1, voAmount: 0.2 })).toBe(0.3);
    expect(orderTotal({ contractSum: 12500, voAmount: 0 })).toBe(12500);
  });

  it("subtracts an omission", () => {
    expect(orderTotal({ contractSum: 12500, voAmount: -1250.5 })).toBe(11249.5);
  });
});

describe("lineAreaM2", () => {
  it("uses the quantity for m2 lines", () => {
    expect(lineAreaM2({ qty: 250, unit: "m2", areaM2: 0 })).toBe(250);
  });

  it("converts sqft lines to m2", () => {
    expect(lineAreaM2({ qty: 1000, unit: "sqft", areaM2: 0 })).toBe(92.9);
  });

  it("uses the keyed-in area for rolls and pieces", () => {
    expect(lineAreaM2({ qty: 3, unit: "roll", areaM2: 120 })).toBe(120);
    expect(lineAreaM2({ qty: 40, unit: "pcs", areaM2: 0 })).toBe(0);
  });
});

describe("totalAreaM2", () => {
  it("sums every line in m2", () => {
    expect(
      totalAreaM2([
        { qty: 100, unit: "m2", areaM2: 0 },
        { qty: 1000, unit: "sqft", areaM2: 0 },
        { qty: 2, unit: "roll", areaM2: 50.1 },
      ]),
    ).toBe(243);
  });

  it("is zero with no lines", () => {
    expect(totalAreaM2([])).toBe(0);
  });
});

describe("needsSupplierPo", () => {
  const exStock = { stockType: "stock" } as const;

  it("is needed for an indent or custom-made line", () => {
    expect(needsSupplierPo([exStock, { stockType: "indent" }], 10)).toBe(true);
    expect(needsSupplierPo([{ stockType: "custom" }], 0)).toBe(true);
  });

  it("is needed from 1,000 m2 even when all ex stock", () => {
    expect(needsSupplierPo([exStock], 1000)).toBe(true);
    expect(needsSupplierPo([exStock], 999.99)).toBe(false);
  });

  it("is not needed for a small ex-stock order", () => {
    expect(needsSupplierPo([exStock], 0)).toBe(false);
    expect(needsSupplierPo([], 0)).toBe(false);
  });
});
