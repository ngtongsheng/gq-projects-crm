import { describe, expect, it } from "vitest";
import { type QuoteRow, toQuoteView, toRegisterRow } from "./quote-view";

const blankItem = {
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "m2" as const,
  qty: null,
  rate: null,
  material: null,
  wastage_pct: null,
  underlay: null,
  accessories: null,
  install: null,
  currency: null,
  fob: null,
  fx: null,
  sst_pct: null,
  shipping: null,
  rug_mode: null,
  length: null,
  width: null,
  piece_cost: null,
  edging: null,
  cost: null,
  linked_item_id: null,
};

const transport = (id: string) => ({
  ...blankItem,
  id,
  position: 1,
  category: "transport" as const,
  type: "lump" as const,
  unit: "trip" as const,
  qty: 1,
  rate: 603,
  cost: 350,
});

// Demo seed quote GQ5153: A is 41.97% margin, B is 34.69%.
const row: QuoteRow = {
  id: "q1",
  quote_no: "GQ5153",
  project_id: null,
  project_name: "Hotel lobby",
  customer_name: "Acme",
  salesperson_id: "p1",
  created_at: "2026-11-01T00:00:00+00:00",
  updated_at: "2026-11-01T00:00:00+00:00",
  quote_revisions: [
    {
      id: "r0",
      rev: 0,
      status: "draft",
      fx_usd: 4.5,
      fx_rmb: 0.6024,
      sst_pct: 10,
      target_margin_pct: 30,
      chosen_option_id: null,
      created_at: "2026-11-01T00:00:00+00:00",
      updated_at: "2026-11-02T00:00:00+00:00",
      quote_options: [
        {
          id: "oB",
          key: "B",
          label: "Carpet tile",
          quote_items: [
            transport("iB2"),
            {
              ...blankItem,
              id: "iB1",
              position: 0,
              category: "si",
              type: "local",
              qty: 300,
              rate: 65,
              material: 32,
              wastage_pct: 5,
              install: 9,
            },
          ],
        },
        {
          id: "oA",
          key: "A",
          label: "Axminster",
          quote_items: [
            {
              ...blankItem,
              id: "iA1",
              position: 0,
              category: "si",
              type: "import",
              qty: 300,
              rate: 149,
              currency: "USD",
              fob: 13,
              fx: 4.5,
              sst_pct: 10,
              shipping: 6,
              wastage_pct: 3,
              install: 14,
            },
            transport("iA2"),
          ],
        },
      ],
      quote_revision_history: [
        {
          action: "created",
          note: "",
          by_id: "p1",
          at: "2026-11-01T00:00:00Z",
        },
      ],
    },
  ],
};

const context = (costShown: boolean, minMarginPct = 30) => ({
  costShown,
  minMarginPct,
  personName: (id: string) => (id === "p1" ? "Ah Kow" : "Unnamed"),
});

const COST_KEYS = [
  "cost",
  "unitCost",
  "lumpCost",
  "profit",
  "margin",
  "lowestMargin",
  "material",
  "wastagePct",
  "underlay",
  "accessories",
  "install",
  "currency",
  "fob",
  "fx",
  "fxUsd",
  "fxRmb",
  "sstPct",
  "shipping",
  "pieceCost",
  "edging",
  "targetMarginPct",
];

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...keysOf(child),
  ]);
}

describe("toQuoteView with the margin flag", () => {
  const view = toQuoteView(row, context(true));

  it("works out option totals from the items, options in key order", () => {
    if (!view.costShown) throw new Error("expected the full view");
    const [a, b] = view.revisions[0].options;
    expect(a.key).toBe("A");
    expect(a.cost).toBe(26288.15);
    expect(a.sell).toBe(45303);
    expect(a.margin).toBeCloseTo(0.4197, 4);
    expect(b.cost).toBe(13130);
    expect(view.revisions[0].lowestMargin).toBeCloseTo(0.3469, 4);
    expect(view.revisions[0].amount).toBe(45303);
  });

  it("keeps items in position order with their cost fields", () => {
    if (!view.costShown) throw new Error("expected the full view");
    const items = view.revisions[0].options[1].items;
    expect(items.map((item) => item.id)).toEqual(["iB1", "iB2"]);
    expect(items[1].lumpCost).toBe(350);
    expect(items[0].material).toBe(32);
  });

  it("names who did each step", () => {
    expect(view.revisions[0].history[0].byName).toBe("Ah Kow");
  });
});

describe("toQuoteView without the margin flag", () => {
  const view = toQuoteView(row, context(false));

  it("has no cost, margin or FOB keys anywhere", () => {
    expect(view.costShown).toBe(false);
    const keys = new Set(keysOf(view));
    for (const key of COST_KEYS) expect(keys).not.toContain(key);
  });

  it("still shows sell figures and the quote amount", () => {
    const [a, b] = view.revisions[0].options;
    expect(a.sell).toBe(45303);
    expect(b.items[0].sell).toBe(19500);
    expect(view.revisions[0].amount).toBe(45303);
  });

  it("shows Low or High against the minimum margin setting", () => {
    const at30 = toQuoteView(row, context(false, 30)).revisions[0];
    expect(at30.options.map((option) => option.marginLevel)).toEqual([
      "high",
      "high",
    ]);
    expect(at30.marginLevel).toBe("high");

    const at40 = toQuoteView(row, context(false, 40)).revisions[0];
    expect(at40.options.map((option) => option.marginLevel)).toEqual([
      "high",
      "low",
    ]);
    expect(at40.marginLevel).toBe("low");
  });
});

describe("toRegisterRow", () => {
  it("summarises the latest revision, with the margin only for the flag", () => {
    const full = toRegisterRow(toQuoteView(row, context(true)));
    expect(full).toMatchObject({
      costShown: true,
      rev: 0,
      status: "draft",
      amount: 45303,
      marginLevel: "high",
      salespersonName: "Ah Kow",
      updatedAt: "2026-11-02T00:00:00+00:00",
    });

    const restricted = toRegisterRow(toQuoteView(row, context(false)));
    expect(restricted).not.toHaveProperty("lowestMargin");
    expect(restricted?.marginLevel).toBe("high");
  });

  it("skips a quote with no revision", () => {
    const empty = toQuoteView({ ...row, quote_revisions: [] }, context(true));
    expect(toRegisterRow(empty)).toBeNull();
  });
});
