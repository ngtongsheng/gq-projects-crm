import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/app/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMonth } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { StatTile } from "../dashboard/dashboard-parts";
import {
  dashboardYears,
  type EventCostRow,
  summariseYear,
  wholeRm,
} from "./marketing-dashboard";
import { expenseLogHref } from "./marketing-expense-filters";
import { MarketingLowBalanceBanners } from "./marketing-low-balance-banners";
import { MarketingSpendChart } from "./marketing-spend-chart";
import type {
  MarketingCategory,
  MarketingExpense,
  PrepaidAccount,
} from "./marketing-types";
import { MarketingYearSelect } from "./marketing-year-select";

const TOP_VENDORS = 10;

const monthName = (month: string) => formatMonth(`${month}-01`);
const monthShort = (month: string) => monthName(month).slice(0, 3);

function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-base font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const headCell =
  "h-9 px-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3 py-2 text-right font-mono tabular-nums";

type MarketingDashboardViewProps = {
  expenses: readonly MarketingExpense[];
  categories: readonly MarketingCategory[];
  eventCosts: readonly EventCostRow[];
  /** Prepaid accounts; those below their alert show as banners. */
  prepaidAccounts: readonly PrepaidAccount[];
  year: string;
  showAllVendors: boolean;
  today: string;
  t: Translate;
};

/** The Dashboard tab (demo mkDash): the year's tiles, category-by-month table, chart, vendors and events. */
export function MarketingDashboardView({
  expenses,
  categories,
  eventCosts,
  prepaidAccounts,
  year,
  showAllVendors,
  today,
  t,
}: MarketingDashboardViewProps) {
  const summary = summariseYear(expenses, categories, year, today);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const vendors = showAllVendors
    ? summary.vendors
    : summary.vendors.slice(0, TOP_VENDORS);
  const topVendorTotal = summary.vendors[0]?.total ?? 0;
  const vendorsHref = (all: boolean) =>
    `/marketing?view=dashboard&year=${year}${all ? "&vendors=all" : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <MarketingLowBalanceBanners accounts={prepaidAccounts} t={t} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={`${t("Total spend")} ${year}`}
          value={formatRm(summary.total)}
        />
        <StatTile
          label={t("Average / month")}
          value={formatRm(summary.average)}
          note={`${summary.monthsWithSpend} ${
            summary.monthsWithSpend === 1
              ? t("month with spend")
              : t("months with spend")
          }`}
        />
        <StatTile
          label={t("Highest month")}
          value={summary.highest ? formatRm(summary.highest.amount) : "—"}
          note={summary.highest ? monthName(summary.highest.month) : undefined}
        />
        <StatTile
          label={t("Last month")}
          value={formatRm(summary.lastMonth.amount)}
          note={monthName(summary.lastMonth.month)}
        />
      </div>

      <Panel
        title={t("By category and month")}
        aside={
          <div className="ml-auto">
            <MarketingYearSelect
              years={dashboardYears(expenses, today)}
              year={year}
            />
          </div>
        }
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-sunk">
              <TableRow className="hover:bg-transparent">
                <TableHead className={headCell}>{t("Category")}</TableHead>
                {summary.months.map((month) => (
                  <TableHead key={month} className={cn(headCell, "text-right")}>
                    {monthShort(month)}
                  </TableHead>
                ))}
                <TableHead className={cn(headCell, "text-right")}>
                  {t("Total")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={row.categoryId} className="hover:bg-sunk">
                  <TableCell className="px-3 py-2 whitespace-nowrap">
                    {row.name}
                  </TableCell>
                  {row.months.map((amount, i) => (
                    <TableCell key={summary.months[i]} className={numberCell}>
                      {amount > 0 ? (
                        <Link
                          href={expenseLogHref({
                            month: summary.months[i],
                            categoryId: row.categoryId,
                          })}
                          className="hover:underline"
                        >
                          {wholeRm(amount)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className={cn(numberCell, "font-semibold")}>
                    {row.total > 0 ? wholeRm(row.total) : "–"}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold hover:bg-sunk">
                <TableCell className="px-3 py-2 uppercase">
                  {t("Total")}
                </TableCell>
                {summary.monthTotals.map((amount, i) => (
                  <TableCell key={summary.months[i]} className={numberCell}>
                    {amount > 0 ? wholeRm(amount) : "–"}
                  </TableCell>
                ))}
                <TableCell className={numberCell}>
                  {wholeRm(summary.total)}
                </TableCell>
              </TableRow>
              <TableRow className="text-muted-foreground hover:bg-sunk">
                <TableCell className="px-3 py-2 whitespace-nowrap">
                  {t("Change vs previous month")}
                </TableCell>
                {summary.changes.map((change, i) => (
                  <TableCell key={summary.months[i]} className={numberCell}>
                    {change && (
                      <span
                        className={change.rising ? "text-bad" : "text-good"}
                      >
                        {change.rising ? "▲" : "▼"}
                        {change.percent}%
                      </span>
                    )}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("Tap a number to see the invoices behind it.")}
        </p>
      </Panel>

      <Panel title={t("Monthly spend by category")}>
        <div className="rounded-xl border bg-card p-4">
          <MarketingSpendChart summary={summary} t={t} />
        </div>
      </Panel>

      <Panel
        title={t("Vendors")}
        aside={
          <>
            <span className="text-sm text-muted-foreground">
              {summary.vendors.length} {t("vendors")} · {year}
            </span>
            {summary.vendors.length > TOP_VENDORS && (
              <Link
                href={vendorsHref(!showAllVendors)}
                className="ml-auto text-sm font-medium hover:underline"
              >
                {showAllVendors ? t("Top 10 only") : t("Show all vendors")}
              </Link>
            )}
          </>
        }
      >
        <DataTable
          rows={vendors}
          getRowKey={(vendor) => vendor.name}
          empty={
            <p className="p-4 text-sm text-muted-foreground">
              {t("No expense this year.")}
            </p>
          }
          columns={[
            {
              key: "rank",
              header: "#",
              numeric: true,
              cell: (vendor) => vendors.indexOf(vendor) + 1,
            },
            {
              key: "vendor",
              header: t("Vendor"),
              cell: (vendor) => (
                <Link
                  href={expenseLogHref({ query: vendor.name })}
                  className="font-medium hover:underline"
                >
                  {vendor.name}
                </Link>
              ),
            },
            {
              key: "main",
              header: t("Mainly for"),
              className: "max-md:hidden",
              cell: (vendor) => categoryName.get(vendor.mainCategoryId),
            },
            {
              key: "invoices",
              header: t("Invoices"),
              numeric: true,
              className: "max-sm:hidden",
              cell: (vendor) => vendor.invoices,
            },
            {
              key: "total",
              header: t("Total (RM)"),
              numeric: true,
              cell: (vendor) => vendor.total.toFixed(2),
            },
            {
              key: "percent",
              header: "%",
              numeric: true,
              className: "max-sm:hidden",
              cell: (vendor) => `${vendor.percent}%`,
            },
            {
              key: "bar",
              header: "",
              className: "w-1/5 max-lg:hidden",
              cell: (vendor) => (
                <div aria-hidden className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-chart-1"
                    style={{
                      width: `${Math.max(2, (vendor.total / topVendorTotal) * 100)}%`,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {t("Tap a vendor to see all their invoices.")}
        </p>
      </Panel>

      {eventCosts.length > 0 && (
        <Panel title={t("Events (costed on their own)")}>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableBody>
                {eventCosts.map((event) => (
                  <TableRow key={event.eventId} className="hover:bg-sunk">
                    <TableCell className="px-3.5 py-2.5">
                      <Link
                        href={`/marketing?view=events&event=${event.eventId}`}
                        className="hover:underline"
                      >
                        {event.name} – {t("total event cost")}
                      </Link>
                    </TableCell>
                    <TableCell className={cn(numberCell, "px-3.5")}>
                      {formatRm(event.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold hover:bg-sunk">
                  <TableCell className="px-3.5 py-2.5">
                    {t("Marketing log + events")}
                  </TableCell>
                  <TableCell className={cn(numberCell, "px-3.5")}>
                    {formatRm(
                      sumRm([summary.total, ...eventCosts.map((e) => e.total)]),
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
}
