/** A column an import understands. `aliases` are other header names people use for it. */
export type ImportField<Key extends string> = {
  key: Key;
  label: string;
  aliases?: readonly string[];
  required?: boolean;
};

export type PastedRecord<Key extends string> = {
  /** Spreadsheet row number, counting the header as row 1. */
  line: number;
  cells: Record<Key, string>;
};

export type MappedPaste<Key extends string> = {
  /** Fields that had a column, in the order they were pasted. */
  columns: Key[];
  /** Labels of required fields with no column. */
  missing: string[];
  /** Headers that matched no field. */
  ignored: string[];
  records: PastedRecord<Key>[];
};

const BOM = "﻿";

/**
 * Splits text copied from Excel or Google Sheets into rows of cells. Cells
 * holding tabs, line breaks or quotes arrive wrapped in quotes with inner
 * quotes doubled. Handles CRLF, LF and CR line ends; drops blank rows.
 */
export function parseTsv(text: string): string[][] {
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;

  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value.trim() !== "")) rows.push(row);
    row = [];
    cell = "";
  };

  while (i < input.length) {
    const ch = input[i];
    if (ch === '"' && cell === "") {
      // Quoted cell: runs to the next quote not doubled.
      i++;
      while (i < input.length) {
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        cell += input[i];
        i++;
      }
      continue;
    }
    if (ch === "\t") {
      row.push(cell);
      cell = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      endRow();
      i += ch === "\r" && input[i + 1] === "\n" ? 2 : 1;
    } else {
      cell += ch;
      i++;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

// "Mobile No.", "mobile_no" and "MOBILE NO" all read as "mobileno".
const headerKey = (header: string) =>
  header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Parses pasted text whose first row is a header, matching headers to fields by label or alias. */
export function mapPaste<Key extends string>(
  text: string,
  fields: readonly ImportField<Key>[],
): MappedPaste<Key> {
  const [header = [], ...body] = parseTsv(text);
  const byHeader = new Map<string, Key>();
  for (const field of fields) {
    for (const name of [field.label, ...(field.aliases ?? [])]) {
      byHeader.set(headerKey(name), field.key);
    }
  }

  const columnAt: (Key | null)[] = [];
  const columns: Key[] = [];
  const ignored: string[] = [];
  for (const name of header) {
    const key = byHeader.get(headerKey(name));
    // A second column for the same field is ignored rather than merged.
    if (key === undefined || columns.includes(key)) {
      columnAt.push(null);
      if (name.trim() !== "") ignored.push(name.trim());
    } else {
      columnAt.push(key);
      columns.push(key);
    }
  }

  const blank = Object.fromEntries(
    fields.map((field) => [field.key, ""]),
  ) as Record<Key, string>;
  const records = body.map((cells, index) => {
    const record = { ...blank };
    cells.forEach((value, column) => {
      const key = columnAt[column];
      if (key) record[key] = value.trim();
    });
    return { line: index + 2, cells: record };
  });

  return {
    columns,
    missing: fields
      .filter((field) => field.required && !columns.includes(field.key))
      .map((field) => field.label),
    ignored,
    records,
  };
}
