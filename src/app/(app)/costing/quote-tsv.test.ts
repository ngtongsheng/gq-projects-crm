import { describe, expect, it } from "vitest";
import type { ClientOption } from "./quote-client-view";
import { quoteTsv } from "./quote-tsv";

const optionA: ClientOption = {
  key: "A",
  label: "Axminster",
  total: 20103,
  lines: [
    {
      no: 1,
      product: "Axminster\t5mm",
      detail: ["Colour: grey", "Area: Lobby"],
      qty: 300,
      unit: "m²",
      rate: 65,
      amount: 19500,
    },
    {
      no: 2,
      product: "Transport",
      detail: [],
      qty: 1,
      unit: "trip",
      rate: 603,
      amount: 603,
    },
  ],
};

const optionB: ClientOption = {
  key: "B",
  label: "Tile",
  total: 1200.5,
  lines: [
    {
      no: 1,
      product: "Tile",
      detail: [],
      qty: 12.5,
      unit: "m²",
      rate: 96.04,
      amount: 1200.5,
    },
  ],
};

const rows = (tsv: string) => tsv.split("\n").map((line) => line.split("\t"));

describe("quoteTsv, one option", () => {
  const table = rows(quoteTsv([optionA]));

  it("has the client columns and one row per line", () => {
    expect(table[0]).toEqual([
      "Item",
      "Product & Sku",
      "Description",
      "Qty",
      "Unit",
      "Rate",
      "Amount",
    ]);
    expect(table[1]).toEqual([
      "1",
      "Axminster 5mm",
      "Colour: grey | Area: Lobby",
      "300",
      "m²",
      "65.00",
      "19500.00",
    ]);
    expect(table).toHaveLength(4);
  });

  it("ends with the total", () => {
    expect(table[3].slice(-2)).toEqual(["total", "20103.00"]);
  });
});

describe("quoteTsv, options side by side", () => {
  const table = rows(quoteTsv([optionA, optionB]));

  it("has a block of columns per option and pads the shorter one", () => {
    expect(table[0]).toHaveLength(11);
    expect(table[0][1]).toBe("Option A Product");
    expect(table[0][6]).toBe("Option B Product");
    expect(table[2].slice(6)).toEqual(["", "", "", "", ""]);
    expect(table[1].slice(6)).toEqual([
      "Tile",
      "12.5",
      "m²",
      "96.04",
      "1200.50",
    ]);
  });

  it("totals each option under its own amount column", () => {
    expect(table.at(-1)).toEqual([
      "TOTAL",
      "",
      "",
      "",
      "",
      "20103.00",
      "",
      "",
      "",
      "",
      "1200.50",
    ]);
  });
});

describe("quoteTsv, safety", () => {
  it("is empty without options", () => {
    expect(quoteTsv([])).toBe("");
  });

  it("has no cost or margin columns", () => {
    const text = quoteTsv([optionA, optionB]).toLowerCase();
    for (const word of ["cost", "margin", "fob", "supplier"]) {
      expect(text).not.toContain(word);
    }
  });
});
