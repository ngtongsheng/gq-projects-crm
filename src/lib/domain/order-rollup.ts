import { isSameMonth } from "@/lib/domain/calendar-grid";
import { MOF_STAGES, type MofStageKey } from "@/lib/domain/mof-stages";
import { pace } from "@/lib/domain/workdays";
import { type CalendarDate, daysBetween } from "@/lib/format/date";
import { sumRm } from "@/lib/format/money";

/** An order as the dashboards total it: what was invoiced and what is still unpaid. */
export type RollupOrder = {
  salespersonId: string;
  loaDate: CalendarDate;
  stage: MofStageKey;
  invoiceDate: CalendarDate | null;
  invoice: number;
  outstanding: number;
};

/** Share of the year gone by `today`, so a yearly target splits into twelve monthly ones like the report's pace. */
export function yearPace(today: CalendarDate): number {
  const monthIndex = Number(today.slice(5, 7)) - 1;
  return (monthIndex + pace(today)) / 12;
}

type Total = { count: number; value: number };

const totalOf = (orders: readonly RollupOrder[]): Total => ({
  count: orders.length,
  value: sumRm(orders.map((order) => order.invoice)),
});

/** Orders registered this month and this year to date, by the date of the LOA. */
export function salesTotals(
  orders: readonly RollupOrder[],
  today: CalendarDate,
): { month: Total; year: Total } {
  return {
    month: totalOf(orders.filter((order) => isSameMonth(order.loaDate, today))),
    year: totalOf(
      orders.filter((order) => order.loaDate.slice(0, 4) === today.slice(0, 4)),
    ),
  };
}

export type StageRow = {
  stage: MofStageKey;
  count: number;
  invoice: number;
  outstanding: number;
};

/** One row per stage of the order's journey, cancelled orders left out. */
export function stageRows(orders: readonly RollupOrder[]): StageRow[] {
  return MOF_STAGES.filter((stage) => stage !== "cancelled").map((stage) => {
    const inStage = orders.filter((order) => order.stage === stage);
    return {
      stage,
      count: inStage.length,
      invoice: sumRm(inStage.map((order) => order.invoice)),
      outstanding: sumRm(inStage.map((order) => order.outstanding)),
    };
  });
}

const AGE_BANDS = [
  { label: "0-30 days", max: 30 },
  { label: "31-60 days", max: 60 },
  { label: "61-90 days", max: 90 },
  { label: "Over 90 days", max: Number.POSITIVE_INFINITY },
] as const;

export type AgeRow = { label: string; count: number; outstanding: number };

/** Unpaid balances by days since the invoice date; orders with no invoice date yet come last. */
export function agedBalances(
  orders: readonly RollupOrder[],
  today: CalendarDate,
): AgeRow[] {
  const unpaid = orders.filter((order) => order.outstanding > 0);
  const dated = unpaid.flatMap((order) =>
    order.invoiceDate === null
      ? []
      : [{ order, age: daysBetween(order.invoiceDate, today) }],
  );
  const bands = AGE_BANDS.map((band, index) => {
    const min =
      index === 0 ? Number.NEGATIVE_INFINITY : AGE_BANDS[index - 1].max;
    const inBand = dated.filter(({ age }) => age > min && age <= band.max);
    return {
      label: band.label,
      count: inBand.length,
      outstanding: sumRm(inBand.map(({ order }) => order.outstanding)),
    };
  });
  const undated = unpaid.filter((order) => order.invoiceDate === null);
  return [
    ...bands,
    {
      label: "No invoice date yet",
      count: undated.length,
      outstanding: sumRm(undated.map((order) => order.outstanding)),
    },
  ];
}

export type SalespersonRow = {
  personId: string;
  yearCount: number;
  yearValue: number;
  outstanding: number;
};

/** Each salesperson's year-to-date sales and what is still owed on their orders. */
export function salespersonRows(
  orders: readonly RollupOrder[],
  today: CalendarDate,
): SalespersonRow[] {
  const ids = [...new Set(orders.map((order) => order.salespersonId))];
  return ids.map((personId) => {
    const theirs = orders.filter((order) => order.salespersonId === personId);
    const thisYear = totalOf(
      theirs.filter((order) => order.loaDate.slice(0, 4) === today.slice(0, 4)),
    );
    return {
      personId,
      yearCount: thisYear.count,
      yearValue: thisYear.value,
      outstanding: sumRm(theirs.map((order) => order.outstanding)),
    };
  });
}
