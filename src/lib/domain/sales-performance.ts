import {
  hasSalesInYear,
  orderInvoice,
  salesIn,
  type VariationOrderSale,
} from "@/lib/domain/order-sales";
import { fromCents, sumRm, toCents } from "@/lib/format/money";

/** An order as the performance table counts it. Cancelled orders are not passed in. */
export type PerformanceOrder = {
  salespersonId: string;
  /** "YYYY-MM-DD" */
  loaDate: string;
  contractSum: number;
  /** Each counts as sales in the month it was confirmed, not the LOA month. */
  variationOrders: readonly VariationOrderSale[];
  /** Everything paid against the order. */
  received: number;
  /** Null when no cost has been entered, or when the viewer may not see cost. */
  cost: number | null;
};

export type PerformancePerson = {
  id: string;
  name: string;
  yearlyTarget: number | null;
};

export type PerformanceRow = {
  personId: string;
  name: string;
  /** Sales by month, January first: the contract sum in the LOA month, each VO in its confirmed month. */
  months: number[];
  ytd: number;
  target: number | null;
  /** Year-to-date sales as a share of the target, to 0.1; null without a target. */
  achievedPct: number | null;
  /** Orders registered (LOA) in the year. */
  count: number;
  /** Margin as a share of sales, over the orders that have a cost; null when none do. */
  marginPct: number | null;
  marginYtd: number | null;
  /** Still owed on all their orders, whatever year they were registered. */
  outstanding: number;
  /** Received as a share of invoiced on all their orders; can pass 100 when overpaid. */
  collectedPct: number | null;
};

const pct = (part: number, whole: number): number | null =>
  toCents(whole) > 0
    ? Math.round((toCents(part) * 1000) / toCents(whole)) / 10
    : null;

const sum = (values: readonly number[]) => sumRm([...values]);

function rowFor(
  personId: string,
  name: string,
  target: number | null,
  year: number,
  orders: readonly PerformanceOrder[],
): PerformanceRow {
  const inYear = orders.filter((order) => order.loaDate.startsWith(`${year}-`));
  const months = Array.from({ length: 12 }, (_, index) => {
    const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
    return sum(orders.map((order) => salesIn(order, prefix)));
  });
  const ytd = sum(orders.map((order) => salesIn(order, `${year}-`)));

  const costed = inYear.filter((order) => order.cost !== null);
  const costedInvoice = sum(costed.map(orderInvoice));
  const marginYtd =
    costed.length === 0
      ? null
      : fromCents(
          toCents(costedInvoice) -
            toCents(sum(costed.map((order) => order.cost ?? 0))),
        );

  const invoiced = sum(orders.map(orderInvoice));
  const received = sum(orders.map((order) => order.received));
  return {
    personId,
    name,
    months,
    ytd,
    target,
    achievedPct: target === null ? null : pct(ytd, target),
    count: inYear.length,
    marginPct: marginYtd === null ? null : pct(marginYtd, costedInvoice),
    marginYtd,
    outstanding: fromCents(Math.max(0, toCents(invoiced) - toCents(received))),
    collectedPct: pct(received, invoiced),
  };
}

/**
 * One row per salesperson for a year, and a total row. A person is listed when they have an order
 * or a variation order dated that year, or a yearly target. The contract sum counts by the LOA
 * date and each variation order by its confirmed date, for the first salesperson.
 */
export function performanceRows(
  orders: readonly PerformanceOrder[],
  people: readonly PerformancePerson[],
  year: number,
): { rows: PerformanceRow[]; total: PerformanceRow } {
  const listed = people
    .filter(
      (person) =>
        person.yearlyTarget !== null ||
        orders.some(
          (order) =>
            order.salespersonId === person.id && hasSalesInYear(order, year),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = listed.map((person) =>
    rowFor(
      person.id,
      person.name,
      person.yearlyTarget,
      year,
      orders.filter((order) => order.salespersonId === person.id),
    ),
  );

  const listedIds = new Set(listed.map((person) => person.id));
  const total = rowFor(
    "total",
    "Total",
    rows.some((row) => row.target !== null)
      ? sum(rows.map((row) => row.target ?? 0))
      : null,
    year,
    orders.filter((order) => listedIds.has(order.salespersonId)),
  );
  return { rows, total };
}
