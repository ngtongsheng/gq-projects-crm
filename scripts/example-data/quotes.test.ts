import { describe, expect, it } from "vitest";
import {
  type CostingItem,
  lowestMargin,
  optionTotals,
} from "@/lib/domain/costing";
import { exampleId } from "./ids.ts";
import { TEST_USERS } from "./people.ts";
import { buildQuotes } from "./quotes.ts";
import type { People, Row } from "./types.ts";

const people = Object.fromEntries(
  TEST_USERS.map((u) => [u.key, exampleId("profiles", u.key)]),
) as People;
const tables = buildQuotes({ people, today: "2026-11-02" });
const rows = (name: string): Row[] => {
  const found = tables.find((t) => t.table === name);
  if (!found) throw new Error(`No table ${name}`);
  return found.rows;
};

const num = (value: unknown) => (value === null ? null : Number(value));

function costingItem(row: Row): CostingItem {
  const shared = {
    qty: num(row.qty),
    rate: num(row.rate),
    supplyOnly: row.category === "supply",
    wastagePct: num(row.wastage_pct),
  };
  const landed = {
    fob: num(row.fob),
    fx: num(row.fx),
    sstPct: num(row.sst_pct),
    shipping: num(row.shipping),
  };
  switch (row.type) {
    case "local":
      return {
        ...shared,
        type: "local",
        material: num(row.material),
        underlay: num(row.underlay),
        accessories: num(row.accessories),
        install: num(row.install),
      };
    case "import":
      return {
        ...shared,
        ...landed,
        type: "import",
        unit: row.unit === "sqft" ? "sqft" : "m2",
        underlay: num(row.underlay),
        install: num(row.install),
      };
    case "rug":
      return {
        ...shared,
        ...landed,
        type: "rug",
        mode: row.rug_mode === "piece" ? "piece" : "area",
        length: num(row.length),
        width: num(row.width),
        pieceCost: num(row.piece_cost),
        edging: num(row.edging),
        install: num(row.install),
      };
    case "labour":
      return {
        ...shared,
        type: "labour",
        install: num(row.install),
        underlay: num(row.underlay),
        accessories: num(row.accessories),
      };
    case "simple":
      return {
        ...shared,
        type: "simple",
        material: num(row.material),
        install: num(row.install),
      };
    case "lump":
      return { ...shared, type: "lump", cost: num(row.cost) };
    default:
      return { type: "discount", rate: num(row.rate) };
  }
}

function lowestMarginOf(quoteKey: string): number | null {
  const revision = exampleId("quote_revisions", quoteKey);
  const optionRows = rows("quote_options").filter(
    (o) => o.revision_id === revision,
  );
  return lowestMargin(
    optionRows.map((option) =>
      optionTotals(
        rows("quote_items")
          .filter((i) => i.option_id === option.id)
          .map(costingItem),
      ),
    ),
  );
}

describe("example quotes", () => {
  it("cover every status and every item type", () => {
    expect(new Set(rows("quote_revisions").map((r) => r.status))).toEqual(
      new Set(["draft", "submitted", "approved", "returned"]),
    );
    expect(new Set(rows("quote_items").map((i) => i.type))).toEqual(
      new Set([
        "local",
        "import",
        "rug",
        "labour",
        "simple",
        "lump",
        "discount",
      ]),
    );
  });

  it("price approved quotes at or above 30% and the submitted one below", () => {
    for (const key of ["meridian-showroom", "kiara-hotel", "sutera-quarters"]) {
      expect(lowestMarginOf(key), key).toBeGreaterThanOrEqual(0.3);
    }
    expect(lowestMarginOf("orion-tower")).toBeLessThan(0.3);
    expect(lowestMarginOf("orion-tower")).toBeGreaterThan(0.2);
  });

  it("has a pending FOB enquiry on a quote that exists", () => {
    const numbers = new Set(rows("quotes").map((q) => q.quote_no));
    const enquiries = rows("fob_enquiries");
    expect(enquiries.some((e) => e.fob === null)).toBe(true);
    for (const e of enquiries) expect(numbers.has(e.quote_no)).toBe(true);
  });
});
