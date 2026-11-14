import { at } from "./dates.ts";
import { exampleId } from "./ids.ts";
import type { PersonKey } from "./people.ts";
import type { BuildContext, ExampleTable, Row } from "./types.ts";

// The demo's seedCosting: six quotes on open projects, one per status mix, with every item
// type between them. Rates are cost over (1 - margin) as in the demo; the database stores
// inputs, never totals.

type Status = "draft" | "submitted" | "approved" | "returned";

type QuoteSeed = {
  key: string;
  quoteNo: string;
  project: string;
  customer: string;
  salesperson: PersonKey;
  projectName: string;
  status: Status;
  /** Target margin the rates are set from, as a fraction. */
  margin: number;
  /** Area in m2 the carpet lines are quoted for. */
  area: number;
  items:
    | "tile"
    | "axminster"
    | "tile-labour"
    | "rug"
    | "import-discount"
    | "tile-site";
  historyNote: string;
};

const QUOTES: QuoteSeed[] = [
  {
    key: "meridian-showroom",
    quoteNo: "GQ5150",
    project: "meridian-showroom",
    customer: "Meridian Interiors Sdn Bhd",
    salesperson: "vernice",
    projectName: "Meridian Showroom Carpet Tiles",
    status: "approved",
    margin: 0.36,
    area: 390,
    items: "tile",
    historyNote: "Lowest margin 30% or more, OK to quote",
  },
  {
    key: "kiara-hotel",
    quoteNo: "GQ5153",
    project: "kiara-hotel",
    customer: "Kiara Design Studio",
    salesperson: "vernice",
    projectName: "Kiara Boutique Hotel Lobby",
    status: "approved",
    margin: 0.42,
    area: 818,
    items: "axminster",
    historyNote: "Lowest margin 30% or more, OK to quote",
  },
  {
    key: "orion-tower",
    quoteNo: "GQ5156",
    project: "orion-tower",
    customer: "Orion Builders Sdn Bhd",
    salesperson: "vanessa",
    projectName: "Orion Office Tower Level 12",
    status: "submitted",
    margin: 0.24,
    area: 1394,
    items: "tile-labour",
    historyNote:
      "Lowest margin 24% is under 30%: competitor price, client is a repeat customer",
  },
  {
    key: "harbour-studio",
    quoteNo: "GQ5159",
    project: "harbour-studio",
    customer: "Harbourline Architects",
    salesperson: "eddie",
    projectName: "Harbourline Studio Fit-out",
    status: "draft",
    margin: 0.31,
    area: 195,
    items: "rug",
    historyNote: "",
  },
  {
    key: "sutera-quarters",
    quoteNo: "GQ5162",
    project: "sutera-quarters",
    customer: "Sutera Hospitality Group",
    salesperson: "vernice",
    projectName: "Sutera Staff Quarters",
    status: "approved",
    margin: 0.47,
    area: 325,
    items: "import-discount",
    historyNote: "Lowest margin 30% or more, OK to quote",
  },
  {
    key: "meridian-condo",
    quoteNo: "GQ5165",
    project: "meridian-condo",
    customer: "Meridian Interiors Sdn Bhd",
    salesperson: "vernice",
    projectName: "Meridian Condo Lobbies",
    status: "returned",
    margin: 0.26,
    area: 483,
    items: "tile-site",
    historyNote: "Please revise to at least 28%",
  },
];

/** Sell price per unit that gives `margin` on `cost`, rounded to whole ringgit as the demo does. */
const rateFor = (cost: number, margin: number) =>
  Math.round(cost / (1 - margin));

// Every item column, null unless the type uses it, so each row satisfies the table's
// per-type checks.
const BLANK_ITEM: Row = {
  area: null,
  product: null,
  supplier: null,
  description: null,
  remark: null,
  unit: "m2",
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

type ItemSeed = Row & { category: string; type: string };

const tileSupplyInstall = (
  m: QuoteSeed,
  product: string,
  material: number,
) => ({
  category: "si",
  type: "local",
  product,
  description: `To Supply and Install:\n${m.projectName}`,
  qty: m.area,
  material,
  install: 9,
  wastage_pct: 5,
  rate: rateFor(material * 1.05 + 9, m.margin),
});

const axminsterSupplyInstall = (m: QuoteSeed) => ({
  category: "si",
  type: "import",
  product: "Axminster carpet 80/20 wool",
  description: "To Supply and Install:",
  supplier: "China mill",
  qty: m.area,
  currency: "USD",
  fob: 13,
  fx: 4.5,
  sst_pct: 10,
  shipping: 6,
  wastage_pct: 3,
  install: 14,
  rate: rateFor((13 * 4.5 * 1.1 + 6) * 1.03 + 14, m.margin),
});

const transport = (m: QuoteSeed): ItemSeed => ({
  category: "transport",
  type: "lump",
  product: "Transportation",
  unit: "trip",
  qty: 1,
  cost: 350,
  rate: rateFor(350, m.margin),
});

/** Options of a quote: each is a label and its items. Option B of Kiara is the demo's alternative. */
function optionsOf(m: QuoteSeed): Array<{ label: string; items: ItemSeed[] }> {
  switch (m.items) {
    case "tile":
      return [
        {
          label: "",
          items: [
            tileSupplyInstall(m, "Carpet tile: Forge FR02 50x50", 38),
            transport(m),
            {
              category: "acc",
              type: "simple",
              product: "Skirting and threshold strips",
              unit: "m",
              qty: 60,
              material: 4,
              install: 1.5,
              rate: rateFor(5.5, m.margin),
            },
          ],
        },
      ];
    case "axminster":
      return [
        {
          label: "Axminster 42oz",
          items: [axminsterSupplyInstall(m), transport(m)],
        },
        {
          label: "Carpet tile alternative",
          items: [
            {
              ...tileSupplyInstall(m, "Carpet tile: Tundra Pewter", 32),
              rate: rateFor(32 * 1.05 + 9, 0.34),
            },
            transport(m),
          ],
        },
      ];
    case "tile-labour":
      return [
        {
          label: "",
          items: [
            tileSupplyInstall(m, "Carpet tile: Forge FR02 50x50", 38),
            {
              category: "install",
              type: "labour",
              product: "Install client-supplied underlay",
              qty: 200,
              install: 6,
              underlay: 1,
              accessories: 0.5,
              rate: rateFor(7.5, m.margin),
            },
            transport(m),
          ],
        },
      ];
    case "rug":
      return [
        {
          label: "",
          items: [
            {
              category: "si",
              type: "rug",
              product: "Hand-tufted rug, custom shape",
              unit: "pc",
              qty: 2,
              rug_mode: "area",
              length: 2.5,
              width: 3.5,
              currency: "USD",
              fob: 28,
              fx: 4.5,
              sst_pct: 10,
              shipping: 6,
              wastage_pct: 0,
              edging: 40,
              install: 0,
              rate: rateFor(2.5 * 3.5 * (28 * 4.5 * 1.1 + 6) + 40, m.margin),
            },
            {
              category: "supply",
              type: "rug",
              product: "Wool rug, supplier price per piece",
              unit: "pc",
              qty: 1,
              rug_mode: "piece",
              piece_cost: 900,
              currency: "USD",
              rate: rateFor(900, m.margin),
            },
            transport(m),
          ],
        },
      ];
    case "import-discount":
      return [
        {
          label: "",
          items: [
            axminsterSupplyInstall(m),
            {
              category: "supply",
              type: "local",
              product: "Underlay, supply only",
              qty: m.area,
              material: 6,
              wastage_pct: 5,
              rate: rateFor(6.3, m.margin),
            },
            transport(m),
            {
              category: "disc",
              type: "discount",
              product: "Repeat customer discount",
              unit: "ls",
              rate: 500,
            },
          ],
        },
      ];
    case "tile-site":
      return [
        {
          label: "",
          items: [
            tileSupplyInstall(m, "Carpet tile: Forge FR02 50x50", 38),
            {
              category: "sl",
              type: "simple",
              product: "Site labour, level the screed",
              unit: "day",
              qty: 3,
              material: 0,
              install: 180,
              rate: rateFor(180, m.margin),
            },
            transport(m),
          ],
        },
      ];
  }
}

const quoteId = (key: string) => exampleId("quotes", key);
const revisionId = (key: string) => exampleId("quote_revisions", key);
const optionId = (key: string, label: string) =>
  exampleId("quote_options", `${key}:${label}`);

/**
 * The costing example rows. The child tables carry `clearedByParent`: they go when their
 * quote goes, because a revision may point at a chosen option and the reset cannot delete
 * options first.
 */
export function buildQuotes({ people, today }: BuildContext): ExampleTable[] {
  const quotes: Row[] = [];
  const revisions: Row[] = [];
  const options: Row[] = [];
  const history: Row[] = [];
  const items: Row[] = [];

  QUOTES.forEach((m, k) => {
    const created = at(today, -(k * 3 + 1), "10:00");
    const owner = people[m.salesperson];
    quotes.push({
      id: quoteId(m.key),
      quote_no: m.quoteNo,
      project_id: exampleId("projects", m.project),
      project_name: m.projectName,
      customer_name: m.customer,
      salesperson_id: owner,
      created_at: created,
      updated_at: created,
    });
    revisions.push({
      id: revisionId(m.key),
      quote_id: quoteId(m.key),
      rev: 0,
      status: m.status,
      fx_usd: 4.5,
      fx_rmb: 0.6024,
      sst_pct: 10,
      target_margin_pct: 30,
      chosen_option_id: null,
      created_at: created,
      updated_at: created,
    });

    const steps: Array<[string, string, string]> = [
      ["created", m.salesperson, ""],
    ];
    if (m.status === "approved" || m.status === "submitted") {
      steps.push([m.status, m.salesperson, m.historyNote]);
    }
    if (m.status === "returned")
      steps.push(["returned", "eddie", m.historyNote]);
    steps.forEach(([action, by, note], i) => {
      history.push({
        id: exampleId("quote_revision_history", `${m.key}:${i}`),
        revision_id: revisionId(m.key),
        action,
        note,
        by_id: people[by as PersonKey],
        at: created,
      });
    });

    optionsOf(m).forEach((option, o) => {
      const key = String.fromCharCode(65 + o);
      const id = optionId(m.key, key);
      options.push({
        id,
        revision_id: revisionId(m.key),
        key,
        label: option.label,
      });
      option.items.forEach((item, position) => {
        items.push({
          ...BLANK_ITEM,
          id: exampleId("quote_items", `${m.key}:${key}:${position}`),
          option_id: id,
          position,
          ...item,
        });
      });
    });
  });

  // One pending and one replied enquiry; the database stamps who replied and when.
  const enquiries: Row[] = [
    {
      id: exampleId("fob_enquiries", "kiara-pending"),
      enquiry_date: today,
      quote_no: "GQ5153",
      salesperson_id: people.vernice,
      product: "Axminster carpet 80/20 wool",
      sizes: "4 m broadloom",
      qty: 818,
      unit: "m2",
      supplier: "China mill",
      currency: "USD",
      fob: null,
      fx: 4.5,
      shipping: null,
      notes: "Hotel lobby, need the price before Friday",
      recorded_by: people.vernice,
    },
    {
      id: exampleId("fob_enquiries", "orion-replied"),
      enquiry_date: today,
      quote_no: "GQ5156",
      salesperson_id: people.vanessa,
      product: "Carpet tile: Forge FR02 50x50",
      sizes: "50 x 50 cm",
      qty: 1394,
      unit: "m2",
      supplier: "China mill",
      currency: "USD",
      fob: 8.2,
      fx: 4.5,
      shipping: 5,
      notes: null,
      recorded_by: people.vanessa,
    },
  ];

  return [
    { table: "quotes", key: "id", rows: quotes },
    {
      table: "quote_revisions",
      key: "id",
      rows: revisions,
      clearedByParent: true,
    },
    { table: "quote_options", key: "id", rows: options, clearedByParent: true },
    {
      table: "quote_revision_history",
      key: "id",
      rows: history,
      clearedByParent: true,
    },
    { table: "quote_items", key: "id", rows: items, clearedByParent: true },
    { table: "fob_enquiries", key: "id", rows: enquiries },
  ];
}
