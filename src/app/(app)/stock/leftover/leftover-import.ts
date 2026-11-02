import type { z } from "zod";
import {
  LEFTOVER_CONDITION_LABEL,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATION_LABEL,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_UNIT_LABEL,
  LEFTOVER_UNITS,
  suggestLeftoverDestination,
} from "@/lib/domain/leftover";
import { buildImportPlan, type ImportPlan } from "@/lib/import/import-plan";
import { cellsOf, matchOption, rejectIssues } from "@/lib/import/match-cells";
import { type ImportField, mapPaste } from "@/lib/import/parse-tsv";
import { leftoverRecordSchema } from "./leftover-record-schema";

export const leftoverImportFields = [
  { key: "mofNo", label: "MOF no", aliases: ["MOF", "Job"], required: true },
  { key: "item", label: "Item", aliases: ["Product"], required: true },
  { key: "qty", label: "Qty", aliases: ["Quantity"], required: true },
  { key: "unit", label: "Unit", required: true },
  { key: "condition", label: "Condition" },
  { key: "destination", label: "Destination", aliases: ["Goes to"] },
  { key: "note", label: "Note", aliases: ["Notes", "Remarks"] },
] as const satisfies readonly ImportField<string>[];
type LeftoverKey = (typeof leftoverImportFields)[number]["key"];

export type LeftoverImportContext = {
  /** Upper-case MOF no to the MOF's id. */
  mofs: ReadonlyMap<string, string>;
  /** `leftoverKey` of every item already recorded, to its id. */
  recorded: ReadonlyMap<string, string>;
};

type LeftoverIdentity = {
  mofId: string;
  item: string;
  qty: number;
  unit: string;
  condition: string;
  destination: string;
};

/** A pasted item matches a recorded one when every fact but the note is the same. */
export const leftoverKey = (leftover: LeftoverIdentity) =>
  [
    leftover.mofId,
    leftover.item.toLowerCase(),
    leftover.qty,
    leftover.unit,
    leftover.condition,
    leftover.destination,
  ].join("|");

function leftoverImportSchema(context: LeftoverImportContext) {
  return cellsOf<LeftoverKey>(leftoverImportFields)
    .transform((cells, ctx) => {
      const issues: string[] = [];
      const mofId = context.mofs.get(cells.mofNo.toUpperCase());
      if (!mofId) issues.push(`No MOF numbered "${cells.mofNo}".`);

      const unit = matchOption(cells.unit, LEFTOVER_UNITS, LEFTOVER_UNIT_LABEL);
      if (!unit) issues.push(`"${cells.unit}" is not a unit.`);
      const condition =
        cells.condition === ""
          ? "good"
          : matchOption(
              cells.condition,
              LEFTOVER_CONDITIONS,
              LEFTOVER_CONDITION_LABEL,
            );
      if (!condition) issues.push(`"${cells.condition}" is not a condition.`);
      // Same suggestion the recording form starts from.
      const destination =
        cells.destination === ""
          ? unit && suggestLeftoverDestination(cells.item, unit)
          : matchOption(
              cells.destination,
              LEFTOVER_DESTINATIONS,
              LEFTOVER_DESTINATION_LABEL,
            );
      if (destination === undefined) {
        issues.push("Destination must be Supplier or GQ.");
      }
      if (issues.length > 0) return rejectIssues(issues, ctx);
      return {
        mofId: mofId ?? "",
        item: cells.item,
        qty: cells.qty.replaceAll(",", ""),
        unit: unit ?? "",
        condition: condition ?? "",
        destination: destination ?? "",
        note: cells.note,
      };
    })
    .pipe(leftoverRecordSchema);
}

export type LeftoverImportRow = z.infer<
  ReturnType<typeof leftoverImportSchema>
>;
export type LeftoverImportPlan = ImportPlan<LeftoverKey, LeftoverImportRow>;

/** Leftover is only added; an item already recorded is skipped, so pasting twice does not double it. */
export function planLeftoverImport(
  text: string,
  context: LeftoverImportContext,
): LeftoverImportPlan {
  return buildImportPlan({
    paste: mapPaste(text, leftoverImportFields),
    schema: leftoverImportSchema(context),
    keyOf: leftoverKey,
    existing: context.recorded,
    onDuplicate: "skip",
  });
}

/** Rows for the import_leftovers database function: only the new ones. */
export function leftoverImportPayload(plan: LeftoverImportPlan) {
  return plan.rows.flatMap(({ action, row }) =>
    action === "add" && row
      ? [
          {
            mof_id: row.mofId,
            item: row.item,
            qty: row.qty,
            unit: row.unit,
            condition: row.condition,
            destination: row.destination,
            note: row.note,
          },
        ]
      : [],
  );
}
