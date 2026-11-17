"use client";

import { Download, Plus, Receipt } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMonth } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { MarketingExcelImportDialog } from "./marketing-excel-import-dialog";
import { MarketingExpenseDialog } from "./marketing-expense-dialog";
import {
  type ExpenseFilters,
  expenseMonths,
  filterExpenses,
  totalRm,
} from "./marketing-expense-filters";
import { CURRENCY_LABEL, PAYMENT_METHOD_LABEL } from "./marketing-options";
import type {
  MarketingCategory,
  MarketingEventOption,
  MarketingExpense,
} from "./marketing-types";

// Radix Select cannot hold an empty value, so "every month / category" is this word.
const ALL = "all";

type MarketingExpenseLogProps = {
  expenses: readonly MarketingExpense[];
  categories: readonly MarketingCategory[];
  events: readonly MarketingEventOption[];
  vendors: readonly string[];
  canEdit: boolean;
  /** Where the log starts: empty from the tab, set when a dashboard number or vendor was clicked. */
  initialFilters: ExpenseFilters;
};

/** The expense log (demo mkExpView): month, category and search filters over every line. A line opens to edit. */
export function MarketingExpenseLog({
  expenses,
  categories,
  events,
  vendors,
  canEdit,
  initialFilters,
}: MarketingExpenseLogProps) {
  const t = useT();
  const [month, setMonth] = useState(initialFilters.month || ALL);
  const [categoryId, setCategoryId] = useState(
    initialFilters.categoryId || ALL,
  );
  const [query, setQuery] = useState(initialFilters.query);
  // null: closed; "new": adding; otherwise the id of the line being edited.
  const [dialog, setDialog] = useState<string | null>(null);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const shown = filterExpenses(expenses, {
    month: month === ALL ? "" : month,
    categoryId: categoryId === ALL ? "" : categoryId,
    query,
  });
  const editing = expenses.find((expense) => expense.id === dialog);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger aria-label={t("Month")} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All months")}</SelectItem>
            {expenseMonths(expenses).map((value) => (
              <SelectItem key={value} value={value}>
                {formatMonth(`${value}-01`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger aria-label={t("Category")} className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("All categories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search description, vendor, ref, event, remarks")}
          aria-label={t("Search expenses")}
          className="w-full sm:w-80"
        />
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {shown.length} {t("lines")} · {formatRm(totalRm(shown))}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/marketing/export" download>
              <Download data-icon="inline-start" />
              {t("Download Excel")}
            </a>
          </Button>
          {canEdit && (
            <>
              <MarketingExcelImportDialog />
              <Button onClick={() => setDialog("new")}>
                <Plus data-icon="inline-start" />
                {t("Add expense")}
              </Button>
            </>
          )}
        </div>
      </div>
      <DataTable
        rows={shown}
        getRowKey={(expense) => expense.id}
        empty={
          <EmptyState
            icon={Receipt}
            title={t("No expense here")}
            description={
              expenses.length === 0 && canEdit
                ? t("Click Add expense to record the first one.")
                : t("Nothing matches. Clear the search or the filter.")
            }
          />
        }
        columns={[
          {
            key: "date",
            header: t("Date"),
            cell: (expense) => formatDate(expense.spentOn),
          },
          {
            key: "category",
            header: t("Category"),
            className: "max-md:hidden",
            cell: (expense) => categoryName.get(expense.categoryId),
          },
          {
            key: "description",
            header: t("Description"),
            cell: (expense) => {
              const text = (
                <span className="flex flex-col whitespace-normal">
                  {expense.description}
                  {expense.eventName && (
                    <span className="text-xs text-muted-foreground">
                      {expense.eventName}
                    </span>
                  )}
                </span>
              );
              return canEdit ? (
                <button
                  type="button"
                  onClick={() => setDialog(expense.id)}
                  className="text-left hover:underline"
                >
                  {text}
                </button>
              ) : (
                text
              );
            },
          },
          {
            key: "vendor",
            header: t("Vendor"),
            className: "max-md:hidden",
            cell: (expense) => expense.vendorName,
          },
          {
            key: "invoice",
            header: t("Invoice / ref"),
            className: "max-lg:hidden",
            cell: (expense) => expense.invoiceRef,
          },
          {
            key: "amount",
            header: t("Amount"),
            numeric: true,
            className: "max-md:hidden",
            cell: (expense) =>
              expense.currency === "RM"
                ? expense.amount.toFixed(2)
                : `${t(CURRENCY_LABEL[expense.currency])} ${expense.amount.toFixed(2)}`,
          },
          {
            key: "rm",
            header: "RM",
            numeric: true,
            cell: (expense) => expense.amountRm.toFixed(2),
          },
          {
            key: "payment",
            header: t("Payment"),
            className: "max-lg:hidden",
            cell: (expense) => t(PAYMENT_METHOD_LABEL[expense.paymentMethod]),
          },
          {
            key: "remarks",
            header: t("Remarks"),
            className: "max-xl:hidden",
            cell: (expense) => (
              <span className="whitespace-normal text-muted-foreground">
                {expense.remarks}
              </span>
            ),
          },
        ]}
      />
      {dialog !== null && (dialog === "new" || editing) && (
        <MarketingExpenseDialog
          key={dialog}
          expense={editing}
          categories={categories}
          events={events}
          vendors={vendors}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
