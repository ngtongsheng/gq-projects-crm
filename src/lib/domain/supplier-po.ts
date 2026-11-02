import type { StatusTone } from "@/components/app/status-badge";
import { addDays, type CalendarDate } from "@/lib/format/date";
import { formatQuantity } from "@/lib/format/quantity";
import { BIG_ORDER_M2, needsSupplierPo, type StockType } from "./mof-totals";

export const SUPPLIER_PO_STATUSES = [
  "pending_order",
  "ordered",
  "in_production",
  "shipping",
  "at_kl_supplier_warehouse",
  "at_best_link_warehouse",
  "delivered",
  "cancelled",
] as const;
export type SupplierPoStatus = (typeof SUPPLIER_PO_STATUSES)[number];

export const SUPPLIER_PO_STATUS_LABEL: Record<SupplierPoStatus, string> = {
  pending_order: "Pending order",
  ordered: "Ordered",
  in_production: "In production",
  shipping: "Shipping",
  at_kl_supplier_warehouse: "At KL supplier warehouse",
  at_best_link_warehouse: "At Best Link warehouse",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const SUPPLIER_PO_STATUS_TONE: Record<SupplierPoStatus, StatusTone> = {
  pending_order: "info",
  ordered: "info",
  in_production: "info",
  shipping: "info",
  at_kl_supplier_warehouse: "good",
  at_best_link_warehouse: "good",
  delivered: "good",
  cancelled: "neutral",
};

// The goods have arrived in KL, or the PO is off: nothing is left to chase.
const FINISHED: readonly SupplierPoStatus[] = [
  "at_kl_supplier_warehouse",
  "at_best_link_warehouse",
  "delivered",
  "cancelled",
];

/** The full PO number as printed in Zoho: the MOF number followed by the 4-digit running number. */
export const supplierPoNumber = (mofNo: string, zohoNo: string): string =>
  `${mofNo}${zohoNo}`;

/** The supplier's expected arrival: PO date plus lead time. */
export const supplierPoEta = (
  poDate: CalendarDate,
  leadTimeDays: number,
): CalendarDate => addDays(poDate, leadTimeDays);

/** Late when the ETA has passed and the goods have not arrived (or the PO is not cancelled). */
export function isSupplierPoOverdue(
  po: { poDate: CalendarDate; leadTimeDays: number; status: SupplierPoStatus },
  today: CalendarDate,
): boolean {
  return (
    !FINISHED.includes(po.status) &&
    supplierPoEta(po.poDate, po.leadTimeDays) < today
  );
}

/** A cancelled PO does not cover the MOF; an MOF that needs a PO still needs one. */
export const hasLiveSupplierPo = (
  pos: readonly { status: SupplierPoStatus }[],
): boolean => pos.some((po) => po.status !== "cancelled");

/** Why the MOF needs a supplier PO, or null when it does not (ex stock and a small order). */
export function supplierPoReason(
  lines: readonly { stockType: StockType }[],
  totalM2: number,
): string | null {
  if (!needsSupplierPo(lines, totalM2)) return null;
  return lines.some((line) => line.stockType !== "stock")
    ? "Needed: an indent or custom made line."
    : `Needed: a big order (${formatQuantity(BIG_ORDER_M2)} m² or more).`;
}
