import { describe, expect, it } from "vitest";
import {
  blankPrintRows,
  type DoLine,
  deliveredEarlierText,
  doItemName,
  doItemsText,
  doLinesSchema,
  doPrintNotices,
  lineFromMofProduct,
  positionAmongMofDos,
  totalQty,
} from "./delivery-order";

const line = (fields: Partial<DoLine> = {}): DoLine => ({
  product: "Carpet Tile",
  code: null,
  description: null,
  batch: null,
  covers: null,
  unit: "Box",
  qty: 0,
  ...fields,
});

describe("doLinesSchema", () => {
  it("trims text, turns blank text into null and drops untouched rows", () => {
    const result = doLinesSchema.parse([
      {
        product: " Carpet Tile ",
        code: " CSC-01 ",
        description: "",
        batch: "",
        covers: "1550 sqft",
        unit: "Box",
        qty: 120,
      },
      {
        product: "Carpet Tile",
        code: "",
        description: "",
        batch: "",
        covers: "",
        unit: "Box",
        qty: 0,
      },
    ]);

    expect(result).toEqual([
      line({ code: "CSC-01", covers: "1550 sqft", qty: 120 }),
    ]);
  });

  it("keeps a row that has only a description", () => {
    const result = doLinesSchema.parse([
      {
        product: "Others",
        code: "",
        description: "Skirting",
        batch: "",
        covers: "",
        unit: "m",
        qty: 0,
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it("refuses a unit outside the list and a negative quantity", () => {
    const row = {
      product: "SPC",
      code: "A",
      description: "",
      batch: "",
      covers: "",
      unit: "Box",
      qty: 1,
    };

    expect(doLinesSchema.safeParse([{ ...row, unit: "kg" }]).success).toBe(
      false,
    );
    expect(doLinesSchema.safeParse([{ ...row, qty: -1 }]).success).toBe(false);
    expect(doLinesSchema.safeParse([{ ...row, product: " " }]).success).toBe(
      false,
    );
  });
});

describe("a DO line's item", () => {
  it("is the code, else the description, else the product", () => {
    expect(doItemName(line({ code: "C1", description: "Grey" }))).toBe("C1");
    expect(doItemName(line({ description: "Grey" }))).toBe("Grey");
    expect(doItemName(line())).toBe("Carpet Tile");
  });

  it("is summarised with quantity and unit", () => {
    expect(
      doItemsText([
        line({ code: "C1", qty: 120 }),
        line({ product: "Adhesive", unit: "Pail", qty: 4 }),
      ]),
    ).toBe("C1 120 Box, Adhesive 4 Pail");
  });

  it("totals the quantities", () => {
    expect(totalQty([line({ qty: 120 }), line({ qty: 4.5 })])).toBe(124.5);
  });
});

describe("blankPrintRows", () => {
  it("fills the table to 12 rows and never goes below zero", () => {
    expect(blankPrintRows(0)).toBe(12);
    expect(blankPrintRows(5)).toBe(7);
    expect(blankPrintRows(15)).toBe(0);
  });
});

describe("deliveredEarlierText", () => {
  it("lists each item with its quantity", () => {
    expect(
      deliveredEarlierText([
        { item: "C1", unit: "Box", qty: 120 },
        { item: "Glue", unit: "Pail", qty: 4 },
      ]),
    ).toBe("C1 120 Box · Glue 4 Pail");
  });
});

describe("lineFromMofProduct", () => {
  it("matches the product group and guesses the unit", () => {
    expect(lineFromMofProduct("Premium carpet tile 50x50", "m2")).toEqual({
      product: "Carpet Tile",
      unit: "Box",
    });
    expect(lineFromMofProduct("Vinyl plank", "roll")).toEqual({
      product: "Vinyl Plank",
      unit: "Roll",
    });
  });

  it("keeps an unknown product's own name", () => {
    expect(lineFromMofProduct("Entrance mat", "pcs").product).toBe(
      "Entrance mat",
    );
  });
});

describe("doPrintNotices", () => {
  const ready = {
    hasNumber: true,
    lineCount: 3,
    paymentChecked: true,
    dosPreApproved: true,
  };

  it("has nothing to say when the DO is ready", () => {
    expect(doPrintNotices(ready)).toEqual([]);
  });

  it("warns about both management checks without blocking", () => {
    expect(
      doPrintNotices({
        ...ready,
        paymentChecked: false,
        dosPreApproved: false,
      }),
    ).toEqual([
      "Payment status not checked.",
      "DO not pre-approved by management.",
    ]);
  });

  it("says when the DO has no number or no items", () => {
    expect(
      doPrintNotices({ ...ready, hasNumber: false, lineCount: 0 }),
    ).toEqual([
      "This DO has no DO no. yet. Issue it from the job first.",
      "No items are on this DO yet.",
    ]);
  });
});

describe("positionAmongMofDos", () => {
  it("orders each MOF's numbered DOs by running no. and skips unnumbered ones", () => {
    const positions = positionAmongMofDos([
      { jobId: "a2", mofId: "m1", runningNo: "5550" },
      { jobId: "a1", mofId: "m1", runningNo: "5542" },
      { jobId: "a3", mofId: "m1", runningNo: null },
      { jobId: "b1", mofId: "m2", runningNo: "5543" },
    ]);

    expect(positions.get("a1")).toEqual({ nth: 1, total: 2 });
    expect(positions.get("a2")).toEqual({ nth: 2, total: 2 });
    expect(positions.get("b1")).toEqual({ nth: 1, total: 1 });
    expect(positions.has("a3")).toBe(false);
  });
});
