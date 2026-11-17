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
