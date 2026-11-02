import { summariseCollection } from "@/lib/domain/collection";
import type { RollupOrder } from "@/lib/domain/order-rollup";
import {
  loadCollectionOrders,
  loadPaymentThreshold,
} from "../collection/collection-data";

export type DashboardOrder = RollupOrder & {
  secondSalespersonId: string | null;
};

/**
 * Every order that is not cancelled, with what is invoiced and still unpaid. The database
 * returns only the payments this person may read, so for Purchasing the unpaid figure is not
 * meaningful and dashboards for that role leave it out.
 */
export async function loadDashboardOrders(): Promise<DashboardOrder[]> {
  const [orders, threshold] = await Promise.all([
    loadCollectionOrders(),
    loadPaymentThreshold(),
  ]);
  return orders.map((order) => ({
    salespersonId: order.salespersonId,
    secondSalespersonId: order.secondSalespersonId,
    loaDate: order.loaDate,
    stage: order.stage,
    invoiceDate: order.invoiceDate,
    invoice: order.invoice,
    outstanding: summariseCollection(
      order.invoice,
      order.payments.map((payment) => payment.amount),
      threshold,
    ).outstanding,
  }));
}
