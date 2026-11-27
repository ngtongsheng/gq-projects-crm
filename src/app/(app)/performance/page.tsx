import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatTile, TileGrid } from "@/app/(app)/dashboard/dashboard-parts";
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
import { seesMofCost } from "@/lib/auth/page-access";
import { requireRole } from "@/lib/auth/require-role";
import { yearPace } from "@/lib/domain/order-rollup";
import {
  bestMonth,
  joinNote,
  type PerformanceRow,
  performanceRows,
  personMofs,
  teamComparison,
} from "@/lib/domain/sales-performance";
import { formatDate, todayMyt } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { loadPerformance } from "./performance-data";
import { PersonMofs } from "./person-mofs";
import { TeamComparison } from "./team-comparison";

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
  const seesCost = await seesMofCost(me);
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
  const teams = teamComparison(orders, people, year);
  const best = bestMonth(total.months);
  // The "this month" line of the team panel: now for this year, December for a finished one.
  const monthIndex = year === thisYear ? Number(today.slice(5, 7)) - 1 : 11;
  const whoId = (await searchParams).who;
  const who = rows.find((row) => row.personId === whoId);
  // Behind where the year should be by now; a finished year has to reach the whole target.
  const expected =
    (year === thisYear
      ? yearPace(today, await loadWorkCalendar("mon-fri"))
      : 1) * 100;

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
      <TileGrid className="lg:grid-cols-4">
        <StatTile
          label={`Team sales ${year}`}
          value={formatRm(total.ytd)}
          note={
            total.target === null
              ? "No target set"
              : `${percent(total.achievedPct)} of ${formatRm(total.target)} target`
          }
        />
        <StatTile
          label="Best month"
          value={best ? MONTHS[best.index] : "–"}
          note={best ? formatRm(best.amount) : "No sales yet"}
        />
        <StatTile
          label="Collected"
          value={formatRm(total.received)}
          note="All MOFs, any year"
        />
        <StatTile
          label="Outstanding"
          value={formatRm(total.outstanding)}
          note="Still to collect"
        />
      </TileGrid>
      {teams.length >= 2 ? (
        <TeamComparison
          teams={teams}
          year={year}
          monthIndex={monthIndex}
          monthLabel={MONTHS[monthIndex]}
          expected={expected}
          seesCost={seesCost}
        />
      ) : null}
      <DataTable
        rows={[...rows, total]}
        getRowKey={(row) => row.personId}
        empty={<p className="p-4 text-sm">No sales for {year} yet.</p>}
        columns={[
          {
            key: "name",
            header: "Salesperson",
            cell: (row) => (
              <SalespersonCell row={row} year={year} today={today} />
            ),
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
            cell: (row) =>
              row.target === null ? (
                "–"
              ) : (
                <>
                  {formatRm(row.target)}
                  {row.fullTarget !== null && row.fullTarget !== row.target ? (
                    <span className="block font-sans text-xs text-muted-foreground">
                      prorated
                    </span>
                  ) : null}
                </>
              ),
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
      {who ? (
        <PersonMofs
          name={who.name}
          year={year}
          lines={personMofs(orders, who.personId, year)}
          seesCost={seesCost}
          closeHref={`/performance?year=${year}`}
        />
      ) : null}
      <p className="text-xs text-muted-foreground">
        Achieved = year-to-date sales ÷ annual target.
        {seesCost
          ? " Margin counts only the MOFs that have a cost."
          : " Margin is shown to the MD, Purchasing and HR & Accounts."}{" "}
        A target is cut to the days someone was here in the year they joined or
        left. Outstanding and collected cover all of a person&apos;s MOFs, from
        any year. Click a name to see their MOFs.
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
  return row.personId === "total" ? <strong>{children}</strong> : children;
}

/** The name opens that person's MOFs under the table; the total row is just a label. */
function SalespersonCell({
  row,
  year,
  today,
}: {
  row: PerformanceRow;
  year: number;
  today: string;
}) {
  if (row.personId === "total") return <strong>{row.name}</strong>;
  const note = joinNote(row.joinedOn, year, today);
  return (
    <>
      <Link
        href={`/performance?year=${year}&who=${row.personId}#person-mofs`}
        className="font-medium underline-offset-2 hover:underline"
      >
        {row.name}
      </Link>
      {note ? (
        <span className="block text-xs text-muted-foreground">
          {note.kind === "joins" ? "Joins" : "Joined"} {formatDate(note.date)}
        </span>
      ) : null}
    </>
  );
}
