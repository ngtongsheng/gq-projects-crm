import { type CsvCell, toCsv } from "./csv";
import { todayMyt } from "./date";

/** A CSV download named like `customers-2026-11-02.csv`. */
export function csvResponse(
  name: string,
  headers: readonly string[],
  rows: readonly (readonly CsvCell[])[],
): Response {
  return new Response(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${todayMyt()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
