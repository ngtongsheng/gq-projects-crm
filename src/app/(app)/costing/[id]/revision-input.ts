import { z } from "zod";
import {
  ItemCategory,
  ItemType,
  ItemUnit,
  type QuoteItemRow,
  RugMode,
} from "../quote-view";
import { typeAllowedIn } from "./item-kinds";

/**
 * What the editor posts when saving a revision. It carries only what a person keys in; sell, cost,
 * profit and margin are never accepted, they are worked out from these when the costing loads
 * (loop 13 D2). Fields only people with "See margin % and cost" may set are read but ignored for
 * everyone else (D3).
 */

const amount = (max: number) => z.number().min(0).max(max).nullable();

/** Trimmed text up to `max` characters; blank is saved as null. */
const text = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((value) => value?.trim() || null);

const ItemInput = z
  .object({
    /** The saved line's id, or null for a line added in the editor. */
    id: z.uuid().nullable(),
    /** The editor's name for the line, so a new installation line can point at a new line. */
    ref: z.string().min(1).max(64),
    /** The line this installation line follows, by `ref`. */
    linkRef: z.string().max(64).nullable(),
    category: ItemCategory,
    type: ItemType,
    area: text(200),
    product: text(200),
    supplier: text(200),
    description: text(2000),
    remark: text(500),
    unit: ItemUnit,
    qty: amount(999_999_999),
    rate: amount(999_999_999),
    material: amount(999_999_999),
    wastagePct: amount(100),
    underlay: amount(999_999_999),
    accessories: amount(999_999_999),
    install: amount(999_999_999),
    currency: z.enum(["USD", "RMB"]).nullable(),
    fob: amount(999_999_999),
    fx: amount(99_999),
    sstPct: amount(100),
    shipping: amount(999_999_999),
    rugMode: RugMode.nullable(),
    length: amount(9_999_999),
    width: amount(9_999_999),
    pieceCost: amount(999_999_999),
    edging: amount(999_999_999),
    lumpCost: amount(999_999_999),
  })
  .refine((item) => typeAllowedIn(item.category, item.type), {
    message: "That kind of line does not fit that category.",
  });
export type ItemInput = z.infer<typeof ItemInput>;

export const RevisionInput = z.object({
  revisionId: z.uuid(),
  fxUsd: z.number().gt(0).max(99_999).nullable(),
  fxRmb: z.number().gt(0).max(99_999).nullable(),
  sstPct: amount(100),
  targetMarginPct: amount(100),
  options: z
    .array(
      z.object({
        id: z.uuid(),
        label: text(200),
        items: z.array(ItemInput).max(300),
      }),
    )
    .max(26),
});
/** What the editor sends, before the server trims the text. */
export type RevisionPayload = z.input<typeof RevisionInput>;

/** The columns of a line that the database keeps, apart from the id, position and link. */
export type ItemColumns = Omit<
  QuoteItemRow,
  "id" | "position" | "linked_item_id"
>;

const NO_COST_FIELDS = {
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
} as const;

/**
 * A line as the database stores it. Each formula keeps only its own cost columns (the table's
 * check refuses stray ones), and a supply-only line drops installation, underlay and accessories.
 */
export function itemColumns(item: ItemInput): ItemColumns {
  const supplyOnly = item.category === "supply";
  const withInstall = (value: number | null) => (supplyOnly ? null : value);
  const base = {
    category: item.category,
    type: item.type,
    area: item.area,
    product: item.product,
    supplier: item.supplier,
    description: item.description,
    remark: item.remark,
    unit: item.unit,
    qty: item.qty,
    rate: item.rate,
    ...NO_COST_FIELDS,
  };
  switch (item.type) {
    case "local":
      return {
        ...base,
        material: item.material,
        wastage_pct: item.wastagePct,
        underlay: withInstall(item.underlay),
        accessories: withInstall(item.accessories),
        install: withInstall(item.install),
      };
    case "import":
      return {
        ...base,
        wastage_pct: item.wastagePct,
        underlay: withInstall(item.underlay),
        install: withInstall(item.install),
        currency: item.currency ?? "USD",
        fob: item.fob,
        fx: item.fx,
        sst_pct: item.sstPct,
        shipping: item.shipping,
      };
    case "rug": {
      const mode = item.rugMode ?? "area";
      const landed = mode === "area";
      return {
        ...base,
        wastage_pct: item.wastagePct,
        install: withInstall(item.install),
        currency: landed ? (item.currency ?? "USD") : null,
        fob: landed ? item.fob : null,
        fx: landed ? item.fx : null,
        sst_pct: landed ? item.sstPct : null,
        shipping: landed ? item.shipping : null,
        rug_mode: mode,
        length: item.length,
        width: item.width,
        piece_cost: landed ? null : item.pieceCost,
        edging: item.edging,
      };
    }
    case "labour":
      return {
        ...base,
        install: item.install,
        underlay: item.underlay,
        accessories: item.accessories,
      };
    case "simple":
      return { ...base, material: item.material, install: item.install };
    case "lump":
      return { ...base, cost: item.lumpCost };
    case "discount":
      return { ...base, qty: 1, unit: "ls" };
  }
}

/** The line with every cost-side field cleared, for people without the margin flag (D3). */
export function withoutCost(item: ItemInput): ItemInput {
  return {
    ...item,
    material: null,
    wastagePct: null,
    underlay: null,
    accessories: null,
    install: null,
    currency: null,
    fob: null,
    fx: null,
    sstPct: null,
    shipping: null,
    rugMode: null,
    pieceCost: null,
    edging: null,
    lumpCost: null,
  };
}

/** The columns someone without the margin flag may change on a saved line. */
export function sellSideColumns(columns: ItemColumns) {
  return {
    category: columns.category,
    area: columns.area,
    product: columns.product,
    supplier: columns.supplier,
    description: columns.description,
    remark: columns.remark,
    unit: columns.unit,
    qty: columns.qty,
    rate: columns.rate,
    length: columns.length,
    width: columns.width,
  };
}
