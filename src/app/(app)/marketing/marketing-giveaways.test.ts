import { describe, expect, it } from "vitest";
import { filterGiveaways, supplierSuggestions } from "./marketing-giveaways";
import type { Giveaway } from "./marketing-types";

const line = (fields: Partial<Giveaway>): Giveaway => ({
  id: crypto.randomUUID(),
  givenOn: "2026-05-01",
  supplier: null,
  invoiceNo: null,
  item: "Catalogue - Savoy",
  givenTo: "Stuarts Design",
  qty: 1,
  unitCost: 0,
  total: 0,
  ...fields,
});

describe("filterGiveaways", () => {
  const lines = [
    line({ givenOn: "2026-04-01", item: "Folder", total: 0.1 }),
    line({
      givenOn: "2026-06-01",
      item: "Catalogue",
      supplier: "Mega Print",
      invoiceNo: "INV-77",
      givenTo: "Hannan Medicare",
      total: 0.2,
    }),
  ];

  it("lists the newest line first and adds the totals in cents", () => {
    const { lines: shown, total } = filterGiveaways(lines, "");
    expect(shown.map((l) => l.item)).toEqual(["Catalogue", "Folder"]);
    expect(total).toBe(0.3);
  });

  it.each([
    ["supplier", "mega"],
    ["invoice no.", "inv-77"],
    ["item", "folder"],
    ["given to", "HANNAN"],
  ])("finds a line by its %s", (_field, query) => {
    expect(filterGiveaways(lines, query).lines).toHaveLength(1);
  });

  it("totals only the lines found", () => {
    expect(filterGiveaways(lines, "folder").total).toBe(0.1);
  });
});

describe("supplierSuggestions", () => {
  it("lists each supplier once, A to Z, without blanks", () => {
    expect(
      supplierSuggestions([
        line({ supplier: "Mega Print" }),
        line({ supplier: null }),
        line({ supplier: "Alpha" }),
        line({ supplier: "Mega Print" }),
      ]),
    ).toEqual(["Alpha", "Mega Print"]);
  });
});
