import type { CellValue, Worksheet } from "exceljs";

/** What a spreadsheet cell holds once formulas, rich text and links are flattened. */
export type Cell = string | number | Date | null;

export function flattenCell(value: CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value;
  if ("richText" in value) return value.richText.map((r) => r.text).join("");
  if ("hyperlink" in value) return value.text;
  if ("formula" in value || "sharedFormula" in value) {
    return value.result === undefined ? null : flattenCell(value.result);
  }
  return null;
}

/** The cell as the text a form field would hold: numbers and dates are written out plainly. */
export function cellText(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
// 1 Jan 1900 to 31 Dec 2099: anything else in a date column is a typo, not a serial.
const MIN_SERIAL = 1;
const MAX_SERIAL = 73_050;

function isoIfReal(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return real ? date.toISOString().slice(0, 10) : null;
}

/**
 * A date cell as yyyy-mm-dd: an Excel date or serial number, dd/mm/yyyy, or yyyy-mm-dd. Blank stays
 * "". Anything else comes back as typed so the form's date check can refuse it.
 */
export function cellDate(cell: Cell | undefined): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : cell.toISOString().slice(0, 10);
  }
  if (typeof cell === "number") {
    if (cell < MIN_SERIAL || cell > MAX_SERIAL) return String(cell);
    return new Date(EXCEL_EPOCH_MS + Math.floor(cell) * DAY_MS)
      .toISOString()
      .slice(0, 10);
  }
  const text = cell.trim();
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (dayFirst) {
    return (
      isoIfReal(
        Number(dayFirst[3]),
        Number(dayFirst[2]),
        Number(dayFirst[1]),
      ) ?? text
    );
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  if (iso) {
    return isoIfReal(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? text;
  }
  return text;
}

/** The row number of the first row in the top of the sheet whose first cell is one of `firstCells`. */
export function findHeaderRow(
  sheet: Worksheet,
  firstCells: readonly string[],
  scanRows = 15,
): number | null {
  const last = Math.min(sheet.rowCount, scanRows);
  for (let n = 1; n <= last; n++) {
    const first = cellText(flattenCell(sheet.getRow(n).getCell(1).value));
    if (firstCells.includes(first.toLowerCase())) return n;
  }
  return null;
}

export type SheetRow = {
  /** The row's number in the sheet, for error messages. */
  number: number;
  /** The first cell, to spot "Total" rows. */
  first: string;
  /** Cells by lower-case column heading. */
  cell: (heading: string) => Cell;
  text: (heading: string) => string;
};

/** The rows under the heading row, with their cells found by heading. Empty rows are left out. */
export function readRows(sheet: Worksheet, headerRow: number): SheetRow[] {
  const heading = sheet.getRow(headerRow);
  const columns = new Map<string, number>();
  for (let c = 1; c <= sheet.columnCount; c++) {
    const name = cellText(flattenCell(heading.getCell(c).value)).toLowerCase();
    if (name !== "" && !columns.has(name)) columns.set(name, c);
  }

  const rows: SheetRow[] = [];
  for (let n = headerRow + 1; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const cell = (name: string): Cell => {
      const column = columns.get(name.toLowerCase());
      return column === undefined
        ? null
        : flattenCell(row.getCell(column).value);
    };
    const first = cellText(flattenCell(row.getCell(1).value));
    const blank = [...columns.values()].every(
      (c) => cellText(flattenCell(row.getCell(c).value)) === "",
    );
    if (blank) continue;
    rows.push({ number: n, first, cell, text: (name) => cellText(cell(name)) });
  }
  return rows;
}

export const isTotalRow = (row: SheetRow) =>
  row.first.toLowerCase().startsWith("total");
