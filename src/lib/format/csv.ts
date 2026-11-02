export type CsvCell = string | number | null;

// Excel needs the BOM to read UTF-8 (names, m²) correctly.
const BOM = "﻿";
// Cells starting with these are run as formulas by Excel and Sheets.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(cell: CsvCell): string {
  if (cell === null) return "";
  // Numbers (money, quantities) are written plain so a sheet can add them up.
  if (typeof cell === "number") return String(cell);
  const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** RFC 4180 text for a header row and data rows, with a UTF-8 BOM and CRLF line ends. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): string {
  const lines = [headers, ...rows].map((line) => line.map(csvCell).join(","));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
