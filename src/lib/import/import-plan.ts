import type { z } from "zod";
import type { ImportField, MappedPaste } from "./parse-tsv";

/** What to do with a pasted row that is already in the CRM. */
export type DuplicateChoice = "skip" | "update";

export type ImportAction = "add" | "update" | "skip" | "invalid";

export type PlannedRow<Key extends string, Row> = {
  line: number;
  cells: Record<Key, string>;
  action: ImportAction;
  errors: string[];
  /** The validated row; null when invalid. */
  row: Row | null;
  /** The record this row updates or matches. */
  existingId: string | null;
};

export type ImportPlan<Key extends string, Row> = {
  columns: Key[];
  missing: string[];
  ignored: string[];
  rows: PlannedRow<Key, Row>[];
};

/**
 * Validates every pasted row and decides what happens to it. Rows matching an
 * existing record (by `keyOf`) are skipped or updated per `onDuplicate`; a row
 * repeating an earlier pasted row is invalid, so one paste never writes twice.
 */
export function buildImportPlan<Key extends string, Row>({
  paste,
  schema,
  keyOf,
  existing,
  onDuplicate,
}: {
  paste: MappedPaste<Key>;
  schema: z.ZodType<Row, Record<Key, string>>;
  keyOf: (row: Row) => string;
  /** Key of every record already in the CRM, to its id. */
  existing: ReadonlyMap<string, string>;
  onDuplicate: DuplicateChoice;
}): ImportPlan<Key, Row> {
  const missingErrors = paste.missing.map(
    (label) => `Add a "${label}" column.`,
  );
  const seen = new Map<string, number>();

  const rows = paste.records.map(({ line, cells }): PlannedRow<Key, Row> => {
    const invalid = (errors: string[]): PlannedRow<Key, Row> => ({
      line,
      cells,
      action: "invalid",
      errors,
      row: null,
      existingId: null,
    });
    if (missingErrors.length > 0) return invalid(missingErrors);

    const parsed = schema.safeParse(cells);
    if (!parsed.success) {
      return invalid([
        ...new Set(parsed.error.issues.map((issue) => issue.message)),
      ]);
    }

    const key = keyOf(parsed.data);
    const earlier = seen.get(key);
    if (earlier !== undefined) return invalid([`Same as row ${earlier}.`]);
    seen.set(key, line);

    const existingId = existing.get(key) ?? null;
    return {
      line,
      cells,
      action: existingId === null ? "add" : onDuplicate,
      errors: [],
      row: parsed.data,
      existingId,
    };
  });

  return {
    columns: paste.columns,
    missing: paste.missing,
    ignored: paste.ignored,
    rows,
  };
}

/** What the paste dialog shows: plain, serialisable, in pasted column order. */
export type ImportPreview = {
  headers: string[];
  missing: string[];
  ignored: string[];
  rows: {
    line: number;
    cells: string[];
    action: ImportAction;
    errors: string[];
  }[];
};

export function toImportPreview<Key extends string, Row>(
  plan: ImportPlan<Key, Row>,
  fields: readonly ImportField<Key>[],
): ImportPreview {
  const labelOf = new Map(fields.map((field) => [field.key, field.label]));
  return {
    headers: plan.columns.map((key) => labelOf.get(key) ?? key),
    missing: plan.missing,
    ignored: plan.ignored,
    rows: plan.rows.map((row) => ({
      line: row.line,
      cells: plan.columns.map((key) => row.cells[key]),
      action: row.action,
      errors: row.errors,
    })),
  };
}

export type ImportCounts = Record<ImportAction, number>;

export function countActions(rows: readonly { action: ImportAction }[]) {
  const counts: ImportCounts = { add: 0, update: 0, skip: 0, invalid: 0 };
  for (const row of rows) counts[row.action]++;
  return counts;
}
