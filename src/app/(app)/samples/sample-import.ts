import type { z } from "zod";
import { SAMPLE_UNITS, type SampleUnit } from "@/lib/domain/samples";
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
import { sampleSchema } from "./sample-schemas";

export const sampleImportFields = [
  { key: "product", label: "Product", required: true },
  { key: "brand", label: "Brand", aliases: ["Supplier"] },
  { key: "sku", label: "SKU", aliases: ["Item code"] },
  { key: "name", label: "Product name", aliases: ["Name"] },
  {
    key: "qty",
    label: "Qty",
    aliases: ["Quantity", "Qty at Best Link"],
    required: true,
  },
  { key: "unit", label: "Unit" },
  {
    key: "spec",
    label: "Size",
    aliases: ["Spec", "Size / spec", "Specification"],
  },
  { key: "notes", label: "Notes", aliases: ["Note"] },
] as const satisfies readonly ImportField<string>[];
type SampleKey = (typeof sampleImportFields)[number]["key"];

export type SampleImportContext = {
  /** `sampleKey` of every listed sample to its id and unit. */
  samples: ReadonlyMap<string, { id: string; unit: SampleUnit }>;
};

/**
 * A pasted line is the listed sample with the same brand and SKU (the database's own rule),
 * or, with no SKU, the same brand and product name.
 */
export const sampleKey = (sample: {
  brand: string | null;
  sku: string | null;
  name: string | null;
}) => {
  const brand = (sample.brand ?? "").toLowerCase();
  return sample.sku
    ? `sku|${brand}|${sample.sku.toUpperCase()}`
    : `name|${brand}|${(sample.name ?? "").toLowerCase()}`;
};

const UNIT_LABEL = Object.fromEntries(
  SAMPLE_UNITS.map((unit) => [unit, unit]),
) as Record<SampleUnit, string>;

// People write "boxes", "pcs", "m2" or "sqm".
function matchUnit(cell: string): SampleUnit | undefined {
  const lower = cell.toLowerCase();
  const aliased = lower === "m2" || lower === "sqm" ? "m²" : lower;
  for (const candidate of [
    aliased,
    aliased.replace(/s$/, ""),
    aliased.replace(/es$/, ""),
  ]) {
    const unit = matchOption(candidate, SAMPLE_UNITS, UNIT_LABEL);
    if (unit) return unit;
  }
  return undefined;
}

function sampleImportSchema(context: SampleImportContext) {
  return cellsOf<SampleKey>(sampleImportFields)
    .transform((cells, ctx) => {
      const issues: string[] = [];
      const saved = context.samples.get(
        sampleKey({
          brand: cells.brand || null,
          sku: cells.sku || null,
          name: cells.name || null,
        }),
      );
      const pasted = cells.unit === "" ? undefined : matchUnit(cells.unit);
      if (cells.unit !== "" && !pasted) {
        issues.push(`"${cells.unit}" is not a unit.`);
      }
      if (pasted && saved && saved.unit !== pasted) {
        issues.push(
          `${cells.sku || cells.name} is counted in ${saved.unit}. The unit can't change.`,
        );
      }
      // A blank quantity would otherwise read as zero and empty the shelf.
      if (cells.qty === "") issues.push("Enter the quantity.");
      if (issues.length > 0) return rejectIssues(issues, ctx);
      return {
        ...cells,
        qty: cells.qty.replaceAll(",", ""),
        unit: pasted ?? saved?.unit ?? "pc",
      };
    })
    .pipe(sampleSchema);
}

export type SampleImportRow = z.infer<ReturnType<typeof sampleImportSchema>>;
export type SampleImportPlan = ImportPlan<SampleKey, SampleImportRow>;

export function planSampleImport(
  text: string,
  onDuplicate: DuplicateChoice,
  context: SampleImportContext,
): SampleImportPlan {
  return buildImportPlan({
    paste: mapPaste(text, sampleImportFields),
    schema: sampleImportSchema(context),
    keyOf: sampleKey,
    existing: new Map(
      [...context.samples].map(([key, sample]) => [key, sample.id]),
    ),
    onDuplicate,
  });
}

/**
 * Rows for the import_samples database function: only rows to add or update. An update carries
 * the sample id and only the pasted columns; the unit never changes.
 */
export function sampleImportPayload(
  plan: SampleImportPlan,
): Record<string, unknown>[] {
  const pasted = new Set<string>(plan.columns);
  return plan.rows.flatMap(
    ({ action, row, existingId }): Record<string, unknown>[] => {
      if (!row || (action !== "add" && action !== "update")) return [];
      const all = {
        product: row.product,
        brand: row.brand,
        sku: row.sku,
        name: row.name,
        qty: row.qty,
        spec: row.spec,
        notes: row.notes,
      };
      if (action === "add") return [{ ...all, unit: row.unit }];
      return [
        {
          id: existingId,
          ...pickKept(all, {
            product: pasted.has("product"),
            brand: pasted.has("brand"),
            sku: pasted.has("sku"),
            name: pasted.has("name"),
            qty: pasted.has("qty"),
            spec: pasted.has("spec"),
            notes: pasted.has("notes"),
          }),
        },
      ];
    },
  );
}
