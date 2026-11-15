import { sumRm } from "@/lib/format/money";

/** A variation order as sales see it: counted in the month it was confirmed. */
export type VariationOrderSale = {
  /** "YYYY-MM-DD" */
  confirmedOn: string;
  /** Negative for an omission or credit note. */
  amount: number;
};

export type SalesOrder = {
  /** "YYYY-MM-DD" */
  loaDate: string;
  contractSum: number;
  variationOrders: readonly VariationOrderSale[];
};

/** Contract sum plus every variation order. */
export function orderInvoice(order: SalesOrder): number {
  return sumRm([
    order.contractSum,
    ...order.variationOrders.map((vo) => vo.amount),
  ]);
}

/**
 * What the order counts as sales for dates starting with the prefix ("2026-11" for a month,
 * "2026-" for a year): the contract sum on the LOA date, each variation order on its own
 * confirmed date.
 */
export function salesIn(order: SalesOrder, prefix: string): number {
  return sumRm([
    ...(order.loaDate.startsWith(prefix) ? [order.contractSum] : []),
    ...order.variationOrders
      .filter((vo) => vo.confirmedOn.startsWith(prefix))
      .map((vo) => vo.amount),
  ]);
}

/** True when the order has sales in the year: its LOA or any variation order falls in it. */
export function hasSalesInYear(order: SalesOrder, year: number): boolean {
  const prefix = `${year}-`;
  return (
    order.loaDate.startsWith(prefix) ||
    order.variationOrders.some((vo) => vo.confirmedOn.startsWith(prefix))
  );
}
