import { describe, expect, it } from "vitest";
import { toClientQuote } from "./quote-client-view";
import { type QuoteRow, toQuoteView } from "./quote-view";

const blank = {
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
      status: "approved",
      fx_usd: 4.5,
      fx_rmb: 0.6,
      sst_pct: 10,
      target_margin_pct: 30,
      chosen_option_id: null,
      created_at: "2026-11-01T00:00:00+00:00",
      updated_at: "2026-11-01T00:00:00+00:00",
      quote_options: [
        {
          id: "oA",
          key: "A",
          label: "Axminster",
          quote_items: [
            {
              ...blank,
              id: "i1",
              position: 0,
              category: "si",
              type: "local",
              product: "Axminster 5mm",
              supplier: "Secret Mills",
              remark: "internal only",
              description: "Colour: grey\n\nPattern: plain",
              area: "Lobby",
              qty: 300,
              rate: 65,
              material: 32,
              install: 9,
            },
            {
              ...blank,
              id: "i2",
              position: 1,
              category: "transport",
              type: "lump",
              unit: "trip",
              product: "Transport",
              qty: null,
              rate: 603,
              cost: 350,
            },
            {
              ...blank,
              id: "i3",
              position: 2,
              category: "supply",
              type: "rug",
              product: "Custom rug",
              unit: "pc",
              qty: 2,
              rate: 500,
              length: 2.5,
              width: 1.5,
              rug_mode: "area",
              fob: 40,
              currency: "USD",
              fx: 4.5,
            },
            {
              ...blank,
              id: "i4",
              position: 3,
              category: "disc",
              type: "discount",
              product: "Discount",
              rate: 1000,
            },
          ],
        },
      ],
      quote_revision_history: [],
    },
  ],
};

const full = toQuoteView(row, {
  costShown: true,
  minMarginPct: 30,
  personName: () => "Ah Kow",
});
const client = toClientQuote(full, full.revisions[0], "GQ5153");
const [option] = client.options;

describe("toClientQuote", () => {
  it("carries the customer-facing figures", () => {
    expect(client).toMatchObject({
      name: "GQ5153",
      customerName: "Acme",
      projectName: "Hotel lobby",
      salespersonName: "Ah Kow",
    });
    expect(option.lines[0]).toMatchObject({
      no: 1,
      product: "Axminster 5mm",
      qty: 300,
      unit: "m²",
      rate: 65,
      amount: 19500,
    });
    expect(option.total).toBe(
      option.lines.reduce((sum, line) => sum + line.amount, 0),
    );
  });

  it("adds the area and rug size under the description, dropping blank lines", () => {
    expect(option.lines[0].detail).toEqual([
      "Colour: grey",
      "Pattern: plain",
      "Area: Lobby",
    ]);
    expect(option.lines[2].detail).toEqual(["Size: 2500mm x 1500mm"]);
  });

  it("treats a lump with no quantity as one and a discount as one deduction", () => {
    expect(option.lines[1]).toMatchObject({ qty: 1, rate: 603, amount: 603 });
    expect(option.lines[3]).toMatchObject({
      qty: 1,
      rate: -1000,
      amount: -1000,
    });
  });

  it("never carries cost, margin, FOB, supplier or remarks, even from the full view", () => {
    const text = JSON.stringify(client);
    for (const hidden of [
      "Secret Mills",
      "internal only",
      "supplier",
      "remark",
      "cost",
      "margin",
      "profit",
      "fob",
      "fx",
      "350",
    ]) {
      expect(text.toLowerCase()).not.toContain(hidden.toLowerCase());
    }
  });
});
