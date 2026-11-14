import { UNIT_LABEL } from "./[id]/item-kinds";
import type { QuoteView } from "./quote-view";

/**
 * What the customer may see of a quote: items, quantities, rates and amounts. It is built field by
 * field from the loaded quote, so cost, margin, FOB, supplier and remarks cannot reach the page,
 * whoever is looking (loop 13 D3 covers the staff view; the client view is stricter).
 */

export type ClientLine = {
  no: number;
  product: string;
  /** Extra lines under the product: description, area, rug size. */
  detail: string[];
  qty: number;
  unit: string;
  rate: number;
  amount: number;
};

export type ClientOption = {
  key: string;
  label: string;
  total: number;
  lines: ClientLine[];
};

export type ClientQuote = {
  /** Quote number with its version, e.g. GQ5153-R1. */
  name: string;
  customerName: string;
  projectName: string;
  salespersonName: string;
  options: ClientOption[];
};

type Revision = QuoteView["revisions"][number];
type Line = Revision["options"][number]["items"][number];

function detailOf(line: Line): string[] {
  const detail = (line.description ?? "")
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  if (line.area && !detail.some((part) => /^area\s*:/i.test(part))) {
    detail.push(`Area: ${line.area}`);
  }
  if (
    line.type === "rug" &&
    line.length &&
    !detail.some((part) => /^size/i.test(part))
  ) {
    detail.push(
      `Size: ${Math.round(line.length * 1000)}mm x ${Math.round((line.width ?? 0) * 1000)}mm`,
    );
  }
  return detail;
}

function clientLine(line: Line, no: number): ClientLine {
  const discount = line.type === "discount";
  return {
    no,
    product: line.product ?? "",
    detail: detailOf(line),
    // A lump sum with no quantity keyed in is one lump; a discount is one deduction.
    qty: discount ? 1 : line.type === "lump" ? line.qty || 1 : (line.qty ?? 0),
    unit: UNIT_LABEL[line.unit],
    rate: discount ? -Math.abs(line.rate ?? 0) : (line.rate ?? 0),
    amount: line.sell,
  };
}

export function toClientQuote(
  quote: QuoteView,
  revision: Revision,
  name: string,
): ClientQuote {
  return {
    name,
    customerName: quote.customerName,
    projectName: quote.projectName,
    salespersonName: quote.salespersonName,
    options: revision.options.map((option) => ({
      key: option.key,
      label: option.label,
      total: option.sell,
      lines: option.items.map((line, index) => clientLine(line, index + 1)),
    })),
  };
}
