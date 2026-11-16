import { z } from "zod";
import { missingDeliveryChecks } from "./delivery-status";

/** Product groups offered on a DO line (demo: DO_PRODUCTS). Free text in the database. */
export const DO_PRODUCTS = [
  "Carpet Tile",
  "Carpet Roll",
  "Vinyl Tile",
  "Vinyl Plank",
  "SPC",
  "Rug",
  "Wallpaper",
  "Accessory",
  "Adhesive",
  "Others",
] as const;

/** Units a DO line can use; the database checks the same list (demo: DO_UNITS). */
export const DO_UNITS = [
  "Box",
  "Pc",
  "Roll",
  "m²",
  "sqft",
  "m",
  "Pail",
  "Set",
  "Lot",
] as const;

/** The printed table always shows this many rows, blank ones filling the gap (demo). */
export const DO_PRINT_ROWS = 12;

const optionalLineText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep each line's text under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

export const doLineSchema = z.object({
  product: z
    .string()
    .trim()
    .min(1, "Choose the product on every line.")
    .max(60, "Keep the product under 60 characters."),
  code: optionalLineText(40),
  description: optionalLineText(200),
  batch: optionalLineText(60),
  covers: optionalLineText(60),
  unit: z.enum(DO_UNITS, "Choose the unit on every line."),
  qty: z
    .number("Key in the quantity as a number.")
    .min(0, "A quantity cannot be negative.")
    .max(9_999_999_999, "That quantity is too large."),
});

/** A DO line as the database keeps it: empty text is null. */
export type DoLine = z.output<typeof doLineSchema>;
/** A DO line as the editor posts it. */
export type DoLineInput = z.input<typeof doLineSchema>;

const MAX_LINES = 100;

/**
 * Checks the posted lines and drops the blank ones (no code, no description and no quantity),
 * as the demo does, so an untouched row in the editor is not saved.
 */
export const doLinesSchema = z
  .array(doLineSchema)
  .max(MAX_LINES, `A DO takes at most ${MAX_LINES} lines.`)
  .transform((lines) =>
    lines.filter((line) => line.code || line.description || line.qty > 0),
  );

/** What a line is counted as across DOs: its code, else its description, else its product. */
export const doItemName = (
  line: Pick<DoLine, "code" | "description" | "product">,
): string => line.code ?? line.description ?? line.product;

/** The one-line summary kept on the DO for lists and the log, e.g. "CSC-01 120 Box, Glue 4 Pail". */
export const doItemsText = (lines: readonly DoLine[]): string =>
  lines
    .map((line) => `${doItemName(line)} ${line.qty} ${line.unit}`)
    .join(", ");

export const totalQty = (lines: readonly Pick<DoLine, "qty">[]): number =>
  lines.reduce((total, line) => total + line.qty, 0);

/** Blank rows to add under the lines so the printed table has `DO_PRINT_ROWS` rows. */
export const blankPrintRows = (lineCount: number): number =>
  Math.max(0, DO_PRINT_ROWS - lineCount);

export type DeliveredEarlier = { item: string; unit: string; qty: number };

/** "CSC-01 120 Box · Glue 4 Pail" for the lines editor's "Delivered on earlier DOs". */
export const deliveredEarlierText = (
  earlier: readonly DeliveredEarlier[],
): string =>
  earlier.map((row) => `${row.item} ${row.qty} ${row.unit}`).join(" · ");

/** A new DO line for a product ordered on the MOF: the nearest product group and a likely unit. */
export function lineFromMofProduct(mofProduct: string, mofUnit: string) {
  const lower = mofProduct.toLowerCase();
  return {
    product:
      DO_PRODUCTS.find((group) => lower.includes(group.toLowerCase())) ??
      (mofProduct.trim() || "Others"),
    unit: /roll/i.test(mofUnit) ? "Roll" : "Box",
  } as const;
}

/**
 * What to tell the person looking at a DO before it goes out. The two management checks are
 * warnings, never a block (D3); a missing number or missing items just cannot print well.
 */
export function doPrintNotices(order: {
  hasNumber: boolean;
  lineCount: number;
  paymentChecked: boolean;
  dosPreApproved: boolean;
}): string[] {
  const notices: string[] = [];
  if (!order.hasNumber)
    notices.push("This DO has no DO no. yet. Issue it from the job first.");
  if (order.lineCount === 0) notices.push("No items are on this DO yet.");
  for (const missing of missingDeliveryChecks(order)) {
    notices.push(`${missing[0]?.toUpperCase()}${missing.slice(1)}.`);
  }
  return notices;
}

/**
 * Where each numbered DO falls among its MOF's DOs, by running no., for "DO 2 of 3" in the
 * delivery log. A DO with no number yet is not counted.
 */
export function positionAmongMofDos(
  orders: readonly { jobId: string; mofId: string; runningNo: string | null }[],
): Map<string, { nth: number; total: number }> {
  const byMof = new Map<string, { jobId: string; runningNo: string }[]>();
  for (const order of orders) {
    if (!order.runningNo) continue;
    const group = byMof.get(order.mofId) ?? [];
    group.push({ jobId: order.jobId, runningNo: order.runningNo });
    byMof.set(order.mofId, group);
  }
  const positions = new Map<string, { nth: number; total: number }>();
  for (const group of byMof.values()) {
    group.sort((a, b) => a.runningNo.localeCompare(b.runningNo));
    group.forEach((order, index) => {
      positions.set(order.jobId, { nth: index + 1, total: group.length });
    });
  }
  return positions;
}
