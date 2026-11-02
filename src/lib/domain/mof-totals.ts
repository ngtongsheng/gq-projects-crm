import { sqftToM2 } from "@/lib/domain/area";
import { sumRm } from "@/lib/format/money";

export type StockType = "stock" | "indent" | "custom";
export type LineUnit = "sqft" | "m2" | "roll" | "pcs";

/** An order this big needs a supplier PO even when every line is ex stock. */
export const BIG_ORDER_M2 = 1000;

/** Order total: contract sum plus variation orders (negative for omissions). */
export function orderTotal(mof: {
  contractSum: number;
  voAmount: number;
}): number {
  return sumRm([mof.contractSum, mof.voAmount]);
}

/** A line's area in m2: from the quantity for area units, as keyed in for rolls and pieces. */
export function lineAreaM2(line: {
  qty: number;
  unit: LineUnit;
  areaM2: number;
}): number {
  if (line.unit === "m2") return line.qty;
  if (line.unit === "sqft") return sqftToM2(line.qty);
  return line.areaM2;
}

export function totalAreaM2(
  lines: readonly { qty: number; unit: LineUnit; areaM2: number }[],
): number {
  const total = lines.reduce((sum, line) => sum + lineAreaM2(line), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export function needsSupplierPo(
  lines: readonly { stockType: StockType }[],
  totalM2: number,
): boolean {
  return (
    lines.some((line) => line.stockType !== "stock") || totalM2 >= BIG_ORDER_M2
  );
}
