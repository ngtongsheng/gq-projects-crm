import { z } from "zod";
import {
  type CostingItem,
  itemTotals,
  lowestMargin,
  marginLevel,
  optionTotals,
  quoteAmount,
} from "@/lib/domain/costing";

/**
 * A quote as the database returns it, and the two shapes the app sends to the browser: the full
 * one with cost and margin, and the restricted one for people without "See margin % and cost"
 * (loop 13 D3). The restricted shape is produced by parsing through its schema, which drops every
 * key it does not list, so a cost field added to the full shape later cannot leak by accident.
 */

const amount = z.number().nullable();
const text = z.string().nullable();

export const QuoteStatus = z.enum([
  "draft",
  "submitted",
  "approved",
  "returned",
]);
export type QuoteStatus = z.infer<typeof QuoteStatus>;

const ItemCategory = z.enum([
  "supply",
  "si",
  "install",
  "transport",
  "acc",
  "sl",
  "labour",
  "disc",
]);
const ItemType = z.enum([
  "local",
  "import",
  "rug",
  "labour",
  "simple",
  "lump",
  "discount",
]);
const ItemUnit = z.enum([
  "m2",
  "sqft",
  "pc",
  "m",
  "set",
  "lot",
  "trip",
  "day",
  "ls",
]);
const RugMode = z.enum(["area", "piece"]);
const HistoryAction = z.enum([
  "created",
  "edited",
  "revised",
  "submitted",
  "approved",
  "returned",
  "chosen",
]);

const quoteItemRow = z.object({
  id: z.string(),
  position: z.number().int(),
  category: ItemCategory,
  type: ItemType,
  area: text,
  product: text,
  supplier: text,
  description: text,
  remark: text,
  unit: ItemUnit,
  qty: amount,
  rate: amount,
  material: amount,
  wastage_pct: amount,
  underlay: amount,
  accessories: amount,
  install: amount,
  currency: z.enum(["USD", "RMB"]).nullable(),
  fob: amount,
  fx: amount,
  sst_pct: amount,
  shipping: amount,
  rug_mode: RugMode.nullable(),
  length: amount,
  width: amount,
  piece_cost: amount,
  edging: amount,
  cost: amount,
  linked_item_id: text,
});
type QuoteItemRow = z.infer<typeof quoteItemRow>;

export const QuoteRow = z.object({
  id: z.string(),
  quote_no: z.string(),
  project_id: text,
  project_name: z.string(),
  customer_name: z.string(),
  salesperson_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  quote_revisions: z.array(
    z.object({
      id: z.string(),
      rev: z.number().int(),
      status: QuoteStatus,
      fx_usd: z.number(),
      fx_rmb: z.number(),
      sst_pct: z.number(),
      target_margin_pct: z.number(),
      chosen_option_id: text,
      created_at: z.string(),
      updated_at: z.string(),
      quote_options: z.array(
        z.object({
          id: z.string(),
          key: z.string(),
          label: z.string(),
          quote_items: z.array(quoteItemRow),
        }),
      ),
      quote_revision_history: z.array(
        z.object({
          action: HistoryAction,
          note: z.string(),
          by_id: z.string(),
          at: z.string(),
        }),
      ),
    }),
  ),
});
export type QuoteRow = z.infer<typeof QuoteRow>;

/** The columns QuoteRow expects, as a nested Supabase select. */
export const QUOTE_SELECT = `id, quote_no, project_id, project_name, customer_name, salesperson_id, created_at, updated_at,
  quote_revisions(id, rev, status, fx_usd, fx_rmb, sst_pct, target_margin_pct, chosen_option_id, created_at, updated_at,
    quote_options(id, key, label,
      quote_items(id, position, category, type, area, product, supplier, description, remark, unit, qty, rate,
        material, wastage_pct, underlay, accessories, install, currency, fob, fx, sst_pct, shipping, rug_mode,
        length, width, piece_cost, edging, cost, linked_item_id)),
    quote_revision_history(action, note, by_id, at))`;

const MarginLevel = z.enum(["low", "high"]).nullable();
export type MarginLevel = z.infer<typeof MarginLevel>;

const RestrictedItem = z.object({
  id: z.string(),
  position: z.number(),
  category: ItemCategory,
  type: ItemType,
  area: text,
  product: text,
  supplier: text,
  description: text,
  remark: text,
  unit: ItemUnit,
  qty: amount,
  rate: amount,
  rugMode: RugMode.nullable(),
  length: amount,
  width: amount,
  linkedItemId: text,
  /** What the customer pays for the line, rounded to cents. */
  sell: z.number(),
});

const FullItem = RestrictedItem.extend({
  material: amount,
  wastagePct: amount,
  underlay: amount,
  accessories: amount,
  install: amount,
  currency: z.enum(["USD", "RMB"]).nullable(),
  fob: amount,
  fx: amount,
  sstPct: amount,
  shipping: amount,
  pieceCost: amount,
  edging: amount,
  /** A transport line's keyed-in lump cost. */
  lumpCost: amount,
  unitCost: z.number(),
  cost: z.number(),
  profit: z.number(),
  margin: z.number().nullable(),
});

const RestrictedOption = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  sell: z.number(),
  marginLevel: MarginLevel,
  items: z.array(RestrictedItem),
});

const FullOption = RestrictedOption.extend({
  cost: z.number(),
  profit: z.number(),
  margin: z.number().nullable(),
  items: z.array(FullItem),
});

const HistoryEntry = z.object({
  action: HistoryAction,
  note: z.string(),
  byName: z.string(),
  at: z.string(),
});

const RestrictedRevision = z.object({
  id: z.string(),
  rev: z.number(),
  status: QuoteStatus,
  chosenOptionId: text,
  createdAt: z.string(),
  updatedAt: z.string(),
  /** The highest option's sell: what the customer is quoted. */
  amount: z.number(),
  /** The weakest option against the minimum margin setting. */
  marginLevel: MarginLevel,
  options: z.array(RestrictedOption),
  history: z.array(HistoryEntry),
});

const FullRevision = RestrictedRevision.extend({
  fxUsd: z.number(),
  fxRmb: z.number(),
  sstPct: z.number(),
  targetMarginPct: z.number(),
  lowestMargin: z.number().nullable(),
  options: z.array(FullOption),
});

const RestrictedQuote = z.object({
  costShown: z.literal(false),
  id: z.string(),
  quoteNo: z.string(),
  projectId: text,
  projectName: z.string(),
  customerName: z.string(),
  salespersonId: z.string(),
  salespersonName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Original first, then R1, R2... */
  revisions: z.array(RestrictedRevision),
});

const FullQuote = RestrictedQuote.extend({
  costShown: z.literal(true),
  revisions: z.array(FullRevision),
});

export type RestrictedQuote = z.infer<typeof RestrictedQuote>;
export type FullQuote = z.infer<typeof FullQuote>;
export type QuoteView = FullQuote | RestrictedQuote;

const RestrictedRegisterRow = z.object({
  costShown: z.literal(false),
  id: z.string(),
  quoteNo: z.string(),
  projectName: z.string(),
  customerName: z.string(),
  salespersonId: z.string(),
  salespersonName: z.string(),
  /** The latest revision's number and status. */
  rev: z.number(),
  revisionCount: z.number(),
  /** The latest revision's option letters, A, B, C. */
  optionKeys: z.array(z.string()),
  status: QuoteStatus,
  amount: z.number(),
  marginLevel: MarginLevel,
  updatedAt: z.string(),
});

const FullRegisterRow = RestrictedRegisterRow.extend({
  costShown: z.literal(true),
  lowestMargin: z.number().nullable(),
});

export type QuoteRegisterRow =
  | z.infer<typeof FullRegisterRow>
  | z.infer<typeof RestrictedRegisterRow>;

/** The line in costing.ts terms. Supply-only is the 'supply' category. */
function costingItemOf(row: QuoteItemRow): CostingItem {
  const priced = { qty: row.qty, rate: row.rate };
  const supplied = {
    ...priced,
    supplyOnly: row.category === "supply",
    wastagePct: row.wastage_pct,
  };
  const landed = {
    fob: row.fob,
    fx: row.fx,
    sstPct: row.sst_pct,
    shipping: row.shipping,
  };
  switch (row.type) {
    case "local":
      return {
        ...supplied,
        type: "local",
        material: row.material,
        underlay: row.underlay,
        accessories: row.accessories,
        install: row.install,
      };
    case "import":
      return {
        ...supplied,
        ...landed,
        type: "import",
        unit: row.unit === "sqft" ? "sqft" : "m2",
        underlay: row.underlay,
        install: row.install,
      };
    case "rug":
      return {
        ...supplied,
        ...landed,
        type: "rug",
        mode: row.rug_mode ?? "area",
        length: row.length,
        width: row.width,
        pieceCost: row.piece_cost,
        edging: row.edging,
        install: row.install,
      };
    case "labour":
      return {
        ...priced,
        type: "labour",
        install: row.install,
        underlay: row.underlay,
        accessories: row.accessories,
      };
    case "simple":
      return {
        ...priced,
        type: "simple",
        material: row.material,
        install: row.install,
      };
    case "lump":
      return { ...priced, type: "lump", cost: row.cost };
    case "discount":
      return { type: "discount", rate: row.rate };
  }
}

function fullItem(row: QuoteItemRow): z.infer<typeof FullItem> {
  const totals = itemTotals(costingItemOf(row));
  return {
    id: row.id,
    position: row.position,
    category: row.category,
    type: row.type,
    area: row.area,
    product: row.product,
    supplier: row.supplier,
    description: row.description,
    remark: row.remark,
    unit: row.unit,
    qty: row.qty,
    rate: row.rate,
    rugMode: row.rug_mode,
    length: row.length,
    width: row.width,
    linkedItemId: row.linked_item_id,
    sell: totals.sell,
    material: row.material,
    wastagePct: row.wastage_pct,
    underlay: row.underlay,
    accessories: row.accessories,
    install: row.install,
    currency: row.currency,
    fob: row.fob,
    fx: row.fx,
    sstPct: row.sst_pct,
    shipping: row.shipping,
    pieceCost: row.piece_cost,
    edging: row.edging,
    lumpCost: row.cost,
    unitCost: totals.unitCost,
    cost: totals.cost,
    profit: totals.profit,
    margin: totals.margin,
  };
}

export type QuoteViewContext = {
  /** Whether this person has "See margin % and cost". */
  costShown: boolean;
  /** The costing_min_margin_pct setting, e.g. 30. */
  minMarginPct: number;
  personName: (id: string) => string;
};

function fullQuote(row: QuoteRow, context: QuoteViewContext): FullQuote {
  const byRev = [...row.quote_revisions].sort((a, b) => a.rev - b.rev);
  return {
    costShown: true,
    id: row.id,
    quoteNo: row.quote_no,
    projectId: row.project_id,
    projectName: row.project_name,
    customerName: row.customer_name,
    salespersonId: row.salesperson_id,
    salespersonName: context.personName(row.salesperson_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revisions: byRev.map((revision) => {
      const options = [...revision.quote_options]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((option) => {
          const lines = [...option.quote_items].sort(
            (a, b) => a.position - b.position,
          );
          const totals = optionTotals(lines.map(costingItemOf));
          return {
            id: option.id,
            key: option.key,
            label: option.label,
            ...totals,
            marginLevel: marginLevel(totals.margin, context.minMarginPct),
            items: lines.map(fullItem),
          };
        });
      const lowest = lowestMargin(options);
      return {
        id: revision.id,
        rev: revision.rev,
        status: revision.status,
        chosenOptionId: revision.chosen_option_id,
        createdAt: revision.created_at,
        updatedAt: revision.updated_at,
        amount: quoteAmount(options),
        marginLevel: marginLevel(lowest, context.minMarginPct),
        lowestMargin: lowest,
        fxUsd: revision.fx_usd,
        fxRmb: revision.fx_rmb,
        sstPct: revision.sst_pct,
        targetMarginPct: revision.target_margin_pct,
        options,
        history: [...revision.quote_revision_history]
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((entry) => ({
            action: entry.action,
            note: entry.note,
            byName: context.personName(entry.by_id),
            at: entry.at,
          })),
      };
    }),
  };
}

/** The quote with its totals worked out, stripped of cost, margin and FOB unless `costShown`. */
export function toQuoteView(
  row: QuoteRow,
  context: QuoteViewContext,
): QuoteView {
  const full = fullQuote(row, context);
  if (context.costShown) return full;
  return RestrictedQuote.parse({ ...full, costShown: false });
}

/** The register line for a quote: its latest revision. Null for a quote with no revision yet. */
export function toRegisterRow(quote: QuoteView): QuoteRegisterRow | null {
  const latest = quote.revisions.at(-1);
  if (!latest) return null;
  const row = {
    id: quote.id,
    quoteNo: quote.quoteNo,
    projectName: quote.projectName,
    customerName: quote.customerName,
    salespersonId: quote.salespersonId,
    salespersonName: quote.salespersonName,
    rev: latest.rev,
    revisionCount: quote.revisions.length,
    optionKeys: latest.options.map((option) => option.key),
    status: latest.status,
    amount: latest.amount,
    marginLevel: latest.marginLevel,
    // Editing items touches the revision, not the quote.
    updatedAt:
      latest.updatedAt > quote.updatedAt ? latest.updatedAt : quote.updatedAt,
  };
  if (!quote.costShown) return { ...row, costShown: false };
  const lowest = quote.revisions.at(-1)?.lowestMargin ?? null;
  return { ...row, costShown: true, lowestMargin: lowest };
}
