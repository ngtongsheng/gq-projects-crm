import { Route } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { EXPENSE_TYPE_LABEL } from "@/lib/domain/claim-expense";
import type { ExpenseFlag, MonthlyFlag } from "@/lib/domain/monthly-claim";
import { formatDate } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { AdjustedNote } from "./adjusted-note";
import { ClaimBanner } from "./claim-banner";
import { expenseFlagText, monthlyFlagText } from "./claim-flag-text";
import { ExpenseDialog, type ExpenseRules } from "./expense-dialog";
import { ExpenseRowActions, ViewReceiptButton } from "./expense-row-actions";
import type { ExpenseLine } from "./my-claim-data";

/** Section B: travelling expenses with numbered receipts and the warnings the checker will see (D5). */
export function ExpenseSection({
  expenses,
  flags,
  monthlyFlag,
  cap,
  editable,
  rules,
  heading,
  t,
}: {
  expenses: ExpenseLine[];
  flags: ReadonlyMap<string, ExpenseFlag[]>;
  monthlyFlag: MonthlyFlag | null;
  /** Petrol, toll and parking claimed so far against the monthly cap; null without a cap. */
  cap: { used: number; max: number } | null;
  editable: boolean;
  rules: ExpenseRules;
  heading: string;
  t: Translate;
}) {
  const columns: DataTableColumn<ExpenseLine>[] = [
    {
      key: "date",
      header: t("Date"),
      cell: (line) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          {formatDate(line.spentOn)}
        </span>
      ),
    },
    {
      key: "type",
      header: t("Type"),
      cell: (line) => (
        <div>
          {t(EXPENSE_TYPE_LABEL[line.expenseType])}
          {line.km !== null && (
            <span className="block text-xs text-muted-foreground">
              {line.km} km
            </span>
          )}
          {line.nights !== null && (
            <span className="block text-xs text-muted-foreground">
              {line.nights} {line.nights === 1 ? t("night") : t("nights")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "what",
      header: t("Where / what"),
      cell: (line) => (
        <div className="min-w-40">
          {line.description}
          <AdjustedNote
            originalAmount={line.originalAmount}
            amount={line.amount}
            reason={line.adjustmentReason}
            t={t}
          />
          {(flags.get(line.id) ?? []).map((flag) => (
            <span key={flag.kind} className="block text-xs text-warn">
              {expenseFlagText(flag, t)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("Amount"),
      numeric: true,
      cell: (line) => formatRm(line.amount),
    },
    {
      key: "receipt",
      header: t("Receipt no."),
      cell: (line) => (
        <div className="flex items-center gap-1">
          {line.receiptNo !== null && <b>R{line.receiptNo}</b>}
          {line.hasReceipt ? (
            <ViewReceiptButton expenseId={line.id} />
          ) : line.expenseType === "mileage" ? (
            "—"
          ) : (
            <span className="text-xs text-warn">{t("none")}</span>
          )}
        </div>
      ),
    },
    ...(editable
      ? [
          {
            key: "actions",
            header: "",
            cell: (line: ExpenseLine) => (
              <ExpenseRowActions
                rules={rules}
                expense={{
                  id: line.id,
                  spentOn: line.spentOn,
                  expenseType: line.expenseType,
                  description: line.description,
                  km: line.km,
                  nights: line.nights,
                  amount: line.amount,
                }}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">{heading}</h2>
        {cap && (
          <span className="text-sm text-muted-foreground">
            {t("Petrol, toll and parking")}{" "}
            <b className={cap.used > cap.max ? "text-bad" : undefined}>
              {formatRm(cap.used)}
            </b>{" "}
            {t("of max")} {formatRm(cap.max)}
          </span>
        )}
        {editable && (
          <span className="ml-auto">
            <ExpenseDialog rules={rules} />
          </span>
        )}
      </div>
      {monthlyFlag && (
        <ClaimBanner tone="warn">{monthlyFlagText(monthlyFlag, t)}</ClaimBanner>
      )}
      <DataTable
        columns={columns}
        rows={expenses}
        getRowKey={(line) => line.id}
        empty={<EmptyState icon={Route} title={t("No expense added yet.")} />}
      />
      {expenses.length > 0 && (
        <p className="text-right text-sm font-semibold">
          {t("Total")}{" "}
          <span className="font-mono tabular-nums">
            {formatRm(sumRm(expenses.map((line) => line.amount)))}
          </span>
        </p>
      )}
    </section>
  );
}
