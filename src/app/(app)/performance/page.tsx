import { Search } from "lucide-react";
import type { Metadata } from "next";
import { DataTable } from "@/components/app/data-table";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canSeeMofCost } from "@/lib/auth/job-role";
import { requireRole } from "@/lib/auth/require-role";
import { yearPace } from "@/lib/domain/order-rollup";
import {
  type PerformanceRow,
  performanceRows,
} from "@/lib/domain/sales-performance";
import { todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { loadPerformance } from "./performance-data";

export const metadata: Metadata = { title: "Sales Performance" };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const percent = (value: number | null, digits = 0) =>
  value === null ? "–" : `${value.toFixed(digits)}%`;

const amount = (value: number) => (value === 0 ? "–" : formatRm(value));

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireRole("admin");
  const today = todayMyt();
  const thisYear = Number(today.slice(0, 4));
  const seesCost = canSeeMofCost(me.jobRole);
  const { orders, people } = await loadPerformance(seesCost);

  const years = [
    ...new Set([
      thisYear,
      ...orders.map((order) => Number(order.loaDate.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);
  const asked = Number((await searchParams).year);
  const year = years.includes(asked) ? asked : thisYear;

  const { rows, total } = performanceRows(orders, people, year);
  // Behind where the year should be by now; a finished year has to reach the whole target.
  const expected = (year === thisYear ? yearPace(today) : 1) * 100;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Performance"
        description={`Sales by month for each salesperson, counted by LOA date. Targets are set in People. ${
          year === thisYear
            ? `The year is ${Math.round(expected)}% gone.`
            : "A finished year."
        }`}
      />
      <form action="/performance" className="flex flex-wrap items-center gap-2">
        <Select name="year" defaultValue={String(year)}>
          <SelectTrigger aria-label="Year" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          <Search data-icon="inline-start" />
          Show
        </Button>
      </form>
      <DataTable
        rows={[...rows, total]}
        getRowKey={(row) => row.personId}
        empty={<p className="p-4 text-sm">No sales for {year} yet.</p>}
        columns={[
          {
            key: "name",
            header: "Salesperson",
            cell: (row) => <Strong row={row}>{row.name}</Strong>,
          },
          ...MONTHS.map((label, index) => ({
            key: `month-${label}`,
            header: label,
            numeric: true,
            cell: (row: PerformanceRow) => (
              <Strong row={row}>{amount(row.months[index])}</Strong>
            ),
          })),
          {
            key: "ytd",
            header: "YTD sales (RM)",
            numeric: true,
            cell: (row) => <Strong row={row}>{amount(row.ytd)}</Strong>,
          },
          {
            key: "target",
            header: "Annual target (RM)",
            numeric: true,
            cell: (row) => (row.target === null ? "–" : formatRm(row.target)),
          },
          {
            key: "achieved",
            header: "Achieved",
            numeric: true,
            cell: (row) =>
              row.achievedPct === null ? (
                "–"
              ) : (
                <StatusBadge
                  tone={row.achievedPct >= expected ? "good" : "bad"}
                >
                  {percent(row.achievedPct)}
                </StatusBadge>
              ),
          },
          {
            key: "count",
            header: "No. of MOFs",
            numeric: true,
            cell: (row) => <Strong row={row}>{row.count}</Strong>,
          },
          ...(seesCost
            ? [
                {
                  key: "marginPct",
                  header: "Avg margin %",
                  numeric: true,
                  cell: (row: PerformanceRow) => percent(row.marginPct),
                },
                {
                  key: "marginYtd",
                  header: "Margin YTD (RM)",
                  numeric: true,
                  cell: (row: PerformanceRow) =>
                    row.marginYtd === null ? "–" : formatRm(row.marginYtd),
                },
              ]
            : []),
          {
            key: "outstanding",
            header: "Outstanding (RM)",
            numeric: true,
            cell: (row) => amount(row.outstanding),
          },
          {
            key: "collected",
            header: "Collected %",
            numeric: true,
            cell: (row) => percent(row.collectedPct),
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Achieved = year-to-date sales ÷ annual target.
        {seesCost
          ? " Margin counts only the MOFs that have a cost."
          : " Margin is shown to the MD, Purchasing and HR & Accounts."}{" "}
        Outstanding and collected cover all of a person&apos;s MOFs, from any
        year.
      </p>
    </div>
  );
}

/** The total row stands out. */
function Strong({
  row,
  children,
}: {
  row: PerformanceRow;
  children: React.ReactNode;
}) {
  return row.personId === "total" ? (
    <strong>{children}</strong>
  ) : (
    <>{children}</>
  );
}
