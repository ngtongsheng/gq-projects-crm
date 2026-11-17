import { sumRm } from "@/lib/format/money";
import type {
  MarketingCategory,
  MarketingEventCost,
  MarketingExpense,
} from "./marketing-types";

export type CategoryRow = {
  categoryId: string;
  name: string;
  /** RM per month, January first. */
  months: number[];
  total: number;
};

/** A month's spend against the month before, only when both months have spend (demo mkDash). */
export type MonthChange = { rising: boolean; percent: number };

export type VendorRow = {
  name: string;
  /** The category this vendor was paid most for. */
  mainCategoryId: string;
  invoices: number;
  total: number;
  /** Share of the year's spend, whole percent. */
  percent: number;
};

export type EventCostRow = { eventId: string; name: string; total: number };

export type YearSummary = {
  year: string;
  /** "YYYY-MM" for January to December. */
  months: string[];
  rows: CategoryRow[];
  monthTotals: number[];
  changes: (MonthChange | null)[];
  total: number;
  monthsWithSpend: number;
  average: number;
  highest: { month: string; amount: number } | null;
  /** The month before today, with its spend (0 when that month is in another year). */
  lastMonth: { month: string; amount: number };
  vendors: VendorRow[];
};

/** The years offered in the year picker: every year with spend plus this one, newest first. */
export function dashboardYears(
  expenses: readonly MarketingExpense[],
  today: string,
): string[] {
  return [
    ...new Set([
      today.slice(0, 4),
      ...expenses.map((e) => e.spentOn.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse();
}

function previousMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  const [y, m] = number === 1 ? [year - 1, 12] : [year, number - 1];
  return `${y}-${String(m).padStart(2, "0")}`;
}

function changeFrom(previous: number, current: number): MonthChange | null {
  if (!(previous > 0 && current > 0)) return null;
  return {
    rising: current > previous,
    percent: Math.round(Math.abs(current / previous - 1) * 100),
  };
}

function topKey(amounts: Map<string, number>): string {
  let best = "";
  let bestAmount = -1;
  for (const [key, amount] of amounts) {
    if (amount > bestAmount) {
      best = key;
      bestAmount = amount;
    }
  }
  return best;
}

function vendorRows(
  expenses: readonly MarketingExpense[],
  total: number,
): VendorRow[] {
  const byVendor = new Map<
    string,
    { amounts: number[]; categories: Map<string, number> }
  >();
  for (const expense of expenses) {
    const vendor = byVendor.get(expense.vendorName) ?? {
      amounts: [],
      categories: new Map<string, number>(),
    };
    vendor.amounts.push(expense.amountRm);
    vendor.categories.set(
      expense.categoryId,
      (vendor.categories.get(expense.categoryId) ?? 0) + expense.amountRm,
    );
    byVendor.set(expense.vendorName, vendor);
  }
  return [...byVendor]
    .map(([name, vendor]) => {
      const vendorTotal = sumRm(vendor.amounts);
      return {
        name,
        mainCategoryId: topKey(vendor.categories),
        invoices: vendor.amounts.length,
        total: vendorTotal,
        percent: total > 0 ? Math.round((vendorTotal / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Everything the Dashboard tab shows for one year. `today` is a Malaysia-time "YYYY-MM-DD". */
export function summariseYear(
  allExpenses: readonly MarketingExpense[],
  categories: readonly MarketingCategory[],
  year: string,
  today: string,
): YearSummary {
  const expenses = allExpenses.filter((e) => e.spentOn.startsWith(`${year}-`));
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const rows = categories.map((category) => {
    const monthly = months.map((month) =>
      sumRm(
        expenses
          .filter(
            (e) => e.categoryId === category.id && e.spentOn.startsWith(month),
          )
          .map((e) => e.amountRm),
      ),
    );
    return {
      categoryId: category.id,
      name: category.name,
      months: monthly,
      total: sumRm(monthly),
    };
  });
  const monthTotals = months.map((month) =>
    sumRm(
      expenses
        .filter((e) => e.spentOn.startsWith(month))
        .map((e) => e.amountRm),
    ),
  );
  const total = sumRm(monthTotals);
  const monthsWithSpend = monthTotals.filter((amount) => amount > 0).length;
  const highestAmount = Math.max(...monthTotals);
  const lastMonth = previousMonth(today.slice(0, 7));
  const lastIndex = months.indexOf(lastMonth);

  return {
    year,
    months,
    rows,
    monthTotals,
    changes: monthTotals.map((amount, i) =>
      i === 0 ? null : changeFrom(monthTotals[i - 1], amount),
    ),
    total,
    monthsWithSpend,
    average: monthsWithSpend > 0 ? total / monthsWithSpend : 0,
    highest:
      highestAmount > 0
        ? {
            month: months[monthTotals.indexOf(highestAmount)],
            amount: highestAmount,
          }
        : null,
    lastMonth: {
      month: lastMonth,
      amount: lastIndex >= 0 ? monthTotals[lastIndex] : 0,
    },
    vendors: vendorRows(expenses, total),
  };
}

/** Each event's own cost-sheet total, by name. Expense-log lines tagged to an event are already in the year's total. */
export function eventCostRows(
  costs: readonly MarketingEventCost[],
): EventCostRow[] {
  const byEvent = new Map<string, { name: string; amounts: number[] }>();
  for (const cost of costs) {
    const event = byEvent.get(cost.eventId) ?? {
      name: cost.eventName,
      amounts: [],
    };
    event.amounts.push(cost.total);
    byEvent.set(cost.eventId, event);
  }
  return [...byEvent]
    .map(([eventId, event]) => ({
      eventId,
      name: event.name,
      total: sumRm(event.amounts),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A whole-ringgit figure for table cells ("12,345"). */
export const wholeRm = (amount: number): string =>
  Math.round(amount).toLocaleString("en-MY");

/** The label above a chart bar: "12k" from 1,000 up. */
export const barLabel = (amount: number): string =>
  amount >= 1000 ? `${Math.round(amount / 1000)}k` : wholeRm(amount);
