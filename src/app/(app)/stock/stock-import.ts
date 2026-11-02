import type { z } from "zod";
import { STOCK_UNIT_LABEL, STOCK_UNITS } from "@/lib/domain/reservation";
import {
  buildImportPlan,
  type DuplicateChoice,
  type ImportPlan,
} from "@/lib/import/import-plan";
import {
  cellsOf,
  matchOption,
  pickKept,
  rejectIssues,
} from "@/lib/import/match-cells";
import { type ImportField, mapPaste } from "@/lib/import/parse-tsv";
import { stockItemSchema } from "./stock-item-schema";

export const stockImportFields = [
  { key: "sku", label: "SKU", aliases: ["Item", "Item code"], required: true },
  { key: "supplier", label: "Supplier", required: true },
  {
    key: "qty",
    label: "Qty",
    aliases: ["Quantity", "On hand"],
    required: true,
  },
  { key: "unit", label: "Unit", required: true },
  { key: "collection", label: "Collection" },
] as const satisfies readonly ImportField<string>[];
type StockKey = (typeof stockImportFields)[number]["key"];

export type StockImportContext = {
  /** Lower-case SKU to the saved item's id and unit. */
  items: ReadonlyMap<string, { id: string; unit: string }>;
};

function stockImportSchema(context: StockImportContext) {
  return cellsOf<StockKey>(stockImportFields)
    .transform((cells, ctx) => {
      const issues: string[] = [];
      const unit =
        cells.unit === ""
          ? ""
          : matchOption(cells.unit, STOCK_UNITS, STOCK_UNIT_LABEL);
      if (unit === undefined) issues.push(`"${cells.unit}" is not a unit.`);
      const saved = context.items.get(cells.sku.toLowerCase());
      if (unit && saved && saved.unit !== unit) {
        issues.push(
          `${cells.sku} is already kept in ${saved.unit}. The unit can't change.`,
        );
      }
      // A blank quantity would otherwise read as zero and empty the shelf.
      if (cells.qty === "") issues.push("Enter the quantity.");
      if (issues.length > 0) return rejectIssues(issues, ctx);
      return { ...cells, unit: unit ?? "", qty: cells.qty.replaceAll(",", "") };
    })
    .pipe(stockItemSchema);
}

export type StockImportRow = z.infer<ReturnType<typeof stockImportSchema>>;
export type StockImportPlan = ImportPlan<StockKey, StockImportRow>;

export function planStockImport(
  text: string,
  onDuplicate: DuplicateChoice,
  context: StockImportContext,
): StockImportPlan {
  return buildImportPlan({
    paste: mapPaste(text, stockImportFields),
    schema: stockImportSchema(context),
    keyOf: (row) => row.sku.toLowerCase(),
    existing: new Map([...context.items].map(([sku, item]) => [sku, item.id])),
    onDuplicate,
  });
}

/**
 * Rows for the import_stock_items database function: only rows to add or update. An update
 * carries the item id and only the pasted columns; the unit never changes.
 */
export function stockImportPayload(
  plan: StockImportPlan,
): Record<string, unknown>[] {
  const pasted = new Set<string>(plan.columns);
  return plan.rows.flatMap(
    ({ action, row, existingId }): Record<string, unknown>[] => {
      if (!row || (action !== "add" && action !== "update")) return [];
      const all = {
        sku: row.sku,
        supplier: row.supplier,
        collection: row.collection,
        qty: row.qty,
        unit: row.unit,
      };
      if (action === "add") return [all];
      return [
        {
          id: existingId,
          ...pickKept(all, {
            supplier: pasted.has("supplier"),
            collection: pasted.has("collection"),
            qty: pasted.has("qty"),
          }),
        },
      ];
    },
  );
}
