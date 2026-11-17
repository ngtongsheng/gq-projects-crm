import { sumRm } from "@/lib/format/money";
import type { Giveaway } from "./marketing-types";

/** The lines matching the search (supplier, invoice, item, given-to; demo mkGiveView), newest first, with their total. */
export function filterGiveaways(
  giveaways: readonly Giveaway[],
  query: string,
): { lines: Giveaway[]; total: number } {
  const needle = query.trim().toLowerCase();
  const lines = giveaways
    .filter(
      (line) =>
        needle === "" ||
        [line.supplier, line.invoiceNo, line.item, line.givenTo]
          .join(" ")
          .toLowerCase()
          .includes(needle),
    )
    .toSorted(
      (a, b) =>
        b.givenOn.localeCompare(a.givenOn) || a.item.localeCompare(b.item),
    );
  return { lines, total: sumRm(lines.map((line) => line.total)) };
}

/** Suppliers used before, offered while typing a new line. */
export const supplierSuggestions = (giveaways: readonly Giveaway[]) =>
  [
    ...new Set(
      giveaways.flatMap((line) => (line.supplier ? [line.supplier] : [])),
    ),
  ].sort((a, b) => a.localeCompare(b));
