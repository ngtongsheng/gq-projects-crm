import { z } from "zod";
import { needsSupplierPo, totalAreaM2 } from "@/lib/domain/mof-totals";
import {
  hasLiveSupplierPo,
  isSupplierPoOverdue,
  SUPPLIER_PO_STATUSES,
  type SupplierPoStatus,
} from "@/lib/domain/supplier-po";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { LineUnit, StockType } from "../mofs/schemas";

export type PoStatusRow = {
  status: SupplierPoStatus;
  count: number;
  late: number;
};

export type PurchasingFacts = {
  poStatuses: PoStatusRow[];
  overduePos: number;
  /** Open orders that need a supplier PO and have none. */
  missingPos: number;
  /** Deliveries done but the signed DO not yet back. */
  unsignedDos: number;
};

const mofRows = z.array(
  z.object({
    stage: z.string(),
    mof_lines: z.array(
      z.object({
        stock_type: StockType,
        qty: z.number(),
        unit: LineUnit,
        area_m2: z.number(),
      }),
    ),
    supplier_pos: z.array(
      z.object({
        status: z.enum(SUPPLIER_PO_STATUSES),
        po_date: z.string(),
        lead_time_days: z.number(),
      }),
    ),
  }),
);

/** Supplier PO progress, orders missing a PO, and unsigned DOs, from the MOF register and delivery orders. */
export async function loadPurchasingFacts(
  today: CalendarDate,
): Promise<PurchasingFacts> {
  const supabase = await createClient();
  const [mofs, unsigned] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "stage, mof_lines(stock_type, qty, unit, area_m2), supplier_pos(status, po_date, lead_time_days)",
      )
      .neq("stage", "cancelled"),
    supabase
      .from("delivery_orders")
      .select("id", { count: "exact", head: true })
      .eq("signed_returned", false)
      .not("delivered_on", "is", null),
  ]);
  if (mofs.error) throw new Error(`Could not load MOFs: ${mofs.error.message}`);
  if (unsigned.error) {
    throw new Error(`Could not load DOs: ${unsigned.error.message}`);
  }

  const orders = mofRows.parse(mofs.data);
  const pos = orders.flatMap((order) =>
    order.supplier_pos.map((po) => ({
      status: po.status,
      poDate: po.po_date,
      leadTimeDays: po.lead_time_days,
    })),
  );
  const poStatuses = SUPPLIER_PO_STATUSES.map((status) => {
    const inStatus = pos.filter((po) => po.status === status);
    return {
      status,
      count: inStatus.length,
      late: inStatus.filter((po) => isSupplierPoOverdue(po, today)).length,
    };
  });
  const missingPos = orders.filter((order) => {
    if (order.stage === "closed") return false;
    const lines = order.mof_lines.map((line) => ({
      stockType: line.stock_type,
      qty: line.qty,
      unit: line.unit,
      areaM2: line.area_m2,
    }));
    return (
      needsSupplierPo(lines, totalAreaM2(lines)) &&
      !hasLiveSupplierPo(order.supplier_pos)
    );
  }).length;

  return {
    poStatuses,
    overduePos: poStatuses.reduce((total, row) => total + row.late, 0),
    missingPos,
    unsignedDos: unsigned.count ?? 0,
  };
}
