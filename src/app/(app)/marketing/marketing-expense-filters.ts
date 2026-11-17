import { sumRm } from "@/lib/format/money";
import type { MarketingExpense } from "./marketing-types";

export type ExpenseFilters = {
  /** "YYYY-MM", or "" for every month. */
  month: string;
  /** A category id, or "" for every category. */
  categoryId: string;
  query: string;
};

/** The months that have expenses, newest first, for the month filter. */
export function expenseMonths(expenses: readonly MarketingExpense[]): string[] {
  return [...new Set(expenses.map((expense) => expense.spentOn.slice(0, 7)))]
    .sort()
    .reverse();
}

function searchText(expense: MarketingExpense): string {
  return [
    expense.description,
    expense.vendorName,
    expense.invoiceRef,
    expense.eventName,
    expense.remarks,
  ]
    .join(" ")
    .toLowerCase();
}

/** The log under the toolbar: date newest first, then the line added last (demo mkExpView). */
export function filterExpenses(
  expenses: readonly MarketingExpense[],
  { month, categoryId, query }: ExpenseFilters,
): MarketingExpense[] {
  const needle = query.trim().toLowerCase();
  return expenses
    .filter(
      (expense) =>
        (month === "" || expense.spentOn.startsWith(month)) &&
        (categoryId === "" || expense.categoryId === categoryId) &&
        (needle === "" || searchText(expense).includes(needle)),
    )
    .sort(
      (a, b) =>
        b.spentOn.localeCompare(a.spentOn) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

export const totalRm = (expenses: readonly MarketingExpense[]) =>
  sumRm(expenses.map((expense) => expense.amountRm));

/** The address of the expense log with these filters already set, for links from the dashboard. */
export function expenseLogHref(filters: Partial<ExpenseFilters>): string {
  const params = new URLSearchParams({ view: "expenses" });
  if (filters.month) params.set("month", filters.month);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.query) params.set("q", filters.query);
  return `/marketing?${params}`;
}

/** The filters an address asks for. A category that no longer exists is dropped. */
export function expenseFiltersFromParams(
  params: Record<string, string | string[] | undefined>,
  categoryIds: ReadonlySet<string>,
): ExpenseFilters {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : "";
  };
  const month = one("month");
  const category = one("category");
  return {
    month: /^\d{4}-\d{2}$/.test(month) ? month : "",
    categoryId: categoryIds.has(category) ? category : "",
    query: one("q"),
  };
}
