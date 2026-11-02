"use server";

import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { canEditStock } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { toImportPreview } from "@/lib/import/import-plan";
import {
  type PasteImportInput,
  type PasteImportSpec,
  type PreviewImportResult,
  previewPasteImport,
  type SaveImportResult,
  savePasteImport,
} from "@/lib/import/paste-import-action";
import {
  planStockImport,
  type StockImportContext,
  type StockImportRow,
  stockImportFields,
  stockImportPayload,
} from "./stock-import";

const itemRows = z.array(
  z.object({ id: z.string(), sku: z.string(), unit: z.string() }),
);

function specFor(
  me: Profile,
): PasteImportSpec<
  StockImportContext,
  (typeof stockImportFields)[number]["key"],
  StockImportRow
> {
  return {
    kind: "stock",
    allowed: canEditStock(me),
    notAllowed: "Only the people who arrange stock can import stock items.",
    async load(supabase) {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, sku, unit");
      if (error) {
        console.error("Could not load stock items for import", error);
        return null;
      }
      return {
        items: new Map(
          itemRows
            .parse(data)
            .map((row) => [
              row.sku.toLowerCase(),
              { id: row.id, unit: row.unit },
            ]),
        ),
      };
    },
    plan: planStockImport,
    toPreview: (plan) => toImportPreview(plan, stockImportFields),
    payload: stockImportPayload,
    rpc: "import_stock_items",
    revalidate: ["/stock"],
  };
}

/** Parses and checks a paste against the stock list without saving anything. */
export async function previewStockImport(
  input: PasteImportInput,
): Promise<PreviewImportResult> {
  const me = await requireSection("stock");
  return previewPasteImport(specFor(me), input);
}

/** Saves the valid stock items of a paste. The unit of an item already in stock never changes. */
export async function importStockItems(
  input: PasteImportInput,
): Promise<SaveImportResult> {
  const me = await requireSection("stock");
  return savePasteImport(specFor(me), input);
}
