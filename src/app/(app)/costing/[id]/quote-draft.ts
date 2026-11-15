import type { z } from "zod";
import {
  type ItemTotals,
  itemTotals,
  type OptionTotals,
  optionTotals,
} from "@/lib/domain/costing";
import {
  costingItemOf,
  type ItemCategory,
  type ItemType,
  type ItemUnit,
  type QuoteView,
} from "../quote-view";
import { defaultType, type Source, typeAllowedIn } from "./item-kinds";
import {
  type ItemInput,
  itemColumns,
  type RevisionPayload,
} from "./revision-input";

/**
 * What the editor holds while someone types: every box is text, so "1." and a blank survive
 * typing. It is turned into numbers only to send (`payloadOf`) and to preview totals.
 */

type Category = z.infer<typeof ItemCategory>;
type Type = z.infer<typeof ItemType>;
type Unit = z.infer<typeof ItemUnit>;
type Revision = QuoteView["revisions"][number];
type ItemView = Revision["options"][number]["items"][number];

export type DraftItem = {
  /** The editor's name for the line; the saved id for a saved line. */
  ref: string;
  /** Null until the line is saved. */
  id: string | null;
  /** The `ref` of the line this installation line follows, or "". */
  linkRef: string;
  category: Category;
  type: Type;
  area: string;
  product: string;
  supplier: string;
  description: string;
  remark: string;
  unit: Unit;
  qty: string;
  rate: string;
  material: string;
  wastagePct: string;
  underlay: string;
  accessories: string;
  install: string;
  currency: "USD" | "RMB";
  fob: string;
  fx: string;
  sstPct: string;
  shipping: string;
  rugMode: "area" | "piece";
  length: string;
  width: string;
  pieceCost: string;
  edging: string;
  lumpCost: string;
};

export type DraftOption = {
  id: string;
  key: string;
  label: string;
  items: DraftItem[];
};

export type Draft = {
  fxUsd: string;
  fxRmb: string;
  sstPct: string;
  targetMarginPct: string;
  options: DraftOption[];
};

const text = (value: string | null | undefined) => value ?? "";
const amountText = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** A cost field is on the view only for people with the margin flag. */
function costOf(item: ItemView) {
  return "unitCost" in item ? item : null;
}

function draftItemFromView(item: ItemView): DraftItem {
  const cost = costOf(item);
  return {
    ref: item.id,
    id: item.id,
    linkRef: text(item.linkedItemId),
    category: item.category,
    type: item.type,
    area: text(item.area),
    product: text(item.product),
    supplier: text(item.supplier),
    description: text(item.description),
    remark: text(item.remark),
    unit: item.unit,
    qty: amountText(item.qty),
    rate: amountText(item.rate),
    material: amountText(cost?.material),
    wastagePct: amountText(cost?.wastagePct),
    underlay: amountText(cost?.underlay),
    accessories: amountText(cost?.accessories),
    install: amountText(cost?.install),
    currency: cost?.currency ?? "USD",
    fob: amountText(cost?.fob),
    fx: amountText(cost?.fx),
    sstPct: amountText(cost?.sstPct),
    shipping: amountText(cost?.shipping),
    rugMode: item.rugMode ?? "area",
    length: amountText(item.length),
    width: amountText(item.width),
    pieceCost: amountText(cost?.pieceCost),
    edging: amountText(cost?.edging),
    lumpCost: amountText(cost?.lumpCost),
  };
}

export function draftFromRevision(revision: Revision): Draft {
  const cost = "fxUsd" in revision ? revision : null;
  return {
    fxUsd: amountText(cost?.fxUsd),
    fxRmb: amountText(cost?.fxRmb),
    sstPct: amountText(cost?.sstPct),
    targetMarginPct: amountText(cost?.targetMarginPct),
    options: revision.options.map((option) => ({
      id: option.id,
      key: option.key,
      label: option.label,
      items: option.items.map(draftItemFromView),
    })),
  };
}

// What a new line of each category starts with (the demo's blankItem).
const STARTING_PRODUCT: Partial<Record<Category, string>> = {
  install: "Installation",
  transport: "Transportation",
  acc: "Accessories",
  sl: "Self Levelling",
  labour: "Labour",
  disc: "Discount",
};
const STARTING_DESCRIPTION: Partial<Record<Category, string>> = {
  supply: "To Supply Only:",
  si: "To Supply and Install:",
};
const STARTING_UNIT: Partial<Record<Category, Unit>> = {
  transport: "trip",
  acc: "pc",
  labour: "day",
  disc: "ls",
};

type Defaults = Pick<Draft, "fxUsd" | "sstPct">;

export function blankItem(
  category: Category,
  source: Source,
  defaults: Defaults,
): DraftItem {
  const type = defaultType(category, source);
  const single = category === "transport" || category === "disc";
  return {
    ref: crypto.randomUUID(),
    id: null,
    linkRef: "",
    category,
    type,
    area: "",
    product: STARTING_PRODUCT[category] ?? "",
    supplier: "",
    description: STARTING_DESCRIPTION[category] ?? "",
    remark: "",
    unit: type === "rug" ? "pc" : (STARTING_UNIT[category] ?? "m2"),
    qty: single || type === "rug" ? "1" : "",
    rate: "",
    material: "",
    wastagePct: "",
    underlay: "",
    accessories: "",
    install: "",
    currency: "USD",
    fob: "",
    fx: type === "import" || type === "rug" ? defaults.fxUsd : "",
    sstPct: type === "import" || type === "rug" ? defaults.sstPct : "",
    shipping: "",
    rugMode: "area",
    length: "",
    width: "",
    pieceCost: "",
    edging: "",
    lumpCost: "",
  };
}

/** What a line keeps when its category or source changes: what the customer sees. */
function keepSellSide(from: DraftItem, to: DraftItem): DraftItem {
  return {
    ...to,
    ref: from.ref,
    id: from.id,
    area: from.area,
    product: from.product || to.product,
    supplier: from.supplier,
    description: from.description || to.description,
    remark: from.remark,
    qty: to.category === "disc" ? "1" : from.qty,
    rate: from.rate,
  };
}

export function changeCategory(
  item: DraftItem,
  category: Category,
  defaults: Defaults,
): DraftItem {
  // Accessory, self levelling and labour lines share one formula too.
  if (typeAllowedIn(category, item.type)) return { ...item, category };
  return keepSellSide(item, blankItem(category, "local", defaults));
}

export function changeSource(
  item: DraftItem,
  source: Source,
  defaults: Defaults,
): DraftItem {
  return keepSellSide(item, blankItem(item.category, source, defaults));
}

/** Installation lines that follow a line take its quantity and unit. */
export function followLinkedLines(items: DraftItem[]): DraftItem[] {
  return items.map((item) => {
    if (item.type !== "labour" || !item.linkRef) return item;
    const source = items.find((other) => other.ref === item.linkRef);
    if (!source) return { ...item, linkRef: "" };
    return { ...item, qty: source.qty, unit: source.unit };
  });
}

const number = (value: string): number | null =>
  value.trim() === "" ? null : Number(value);

function itemOf(item: DraftItem): ItemInput {
  return {
    id: item.id,
    ref: item.ref,
    linkRef: item.linkRef === "" ? null : item.linkRef,
    category: item.category,
    type: item.type,
    area: item.area,
    product: item.product,
    supplier: item.supplier,
    description: item.description,
    remark: item.remark,
    unit: item.unit,
    qty: number(item.qty),
    rate: number(item.rate),
    material: number(item.material),
    wastagePct: number(item.wastagePct),
    underlay: number(item.underlay),
    accessories: number(item.accessories),
    install: number(item.install),
    currency: item.currency,
    fob: number(item.fob),
    fx: number(item.fx),
    sstPct: number(item.sstPct),
    shipping: number(item.shipping),
    rugMode: item.rugMode,
    length: number(item.length),
    width: number(item.width),
    pieceCost: number(item.pieceCost),
    edging: number(item.edging),
    lumpCost: number(item.lumpCost),
  };
}

export function payloadOf(revisionId: string, draft: Draft): RevisionPayload {
  return {
    revisionId,
    fxUsd: number(draft.fxUsd),
    fxRmb: number(draft.fxRmb),
    sstPct: number(draft.sstPct),
    targetMarginPct: number(draft.targetMarginPct),
    options: draft.options.map((option) => ({
      id: option.id,
      label: option.label,
      items: option.items.map(itemOf),
    })),
  };
}

function costingItemOfDraft(item: DraftItem, position: number) {
  return costingItemOf({
    ...itemColumns(itemOf(item)),
    id: item.ref,
    position,
    linked_item_id: null,
  });
}

/** One line's numbers as they will be after saving; cost only means something with the margin flag. */
export function previewItem(item: DraftItem, position: number): ItemTotals {
  return itemTotals(costingItemOfDraft(item, position));
}

export function previewOption(option: DraftOption): OptionTotals {
  return optionTotals(
    option.items.map((item, position) => costingItemOfDraft(item, position)),
  );
}

/** The sell rate that gives `marginPct` on this line's cost, rounded up to whole RM (the demo). */
export function rateForMargin(
  item: DraftItem,
  position: number,
  marginPct: number,
): number {
  return Math.ceil(
    previewItem(item, position).unitCost / (1 - marginPct / 100),
  );
}
