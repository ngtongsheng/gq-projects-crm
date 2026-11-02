import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { TargetProgress } from "@/components/app/target-progress";
import type { ReportStats } from "@/lib/domain/report-stats";
import { formatRm } from "@/lib/format/money";
import type { MonthlyReport } from "../report-data";
import type { ReportsView } from "../report-params";
import { flagFor, reportHref } from "../report-view";

export type TeamRow = {
  id: string;
  name: string;
  report: MonthlyReport | null;
  /** Frozen figures once submitted, otherwise today's. */
  stats: ReportStats;
};

const visitsColumn = (pace: number): DataTableColumn<TeamRow> => ({
  key: "visits",
  header: "Visits / target",
  numeric: true,
  cell: ({ stats }) =>
    stats.kind === "site" ? (
      <TargetProgress
        done={stats.siteVisits}
        target={stats.siteVisitTarget}
        pace={pace}
      />
    ) : (
      <TargetProgress
        done={stats.visits}
        target={stats.visitTarget}
        pace={pace}
      />
    ),
});

const salesColumns: DataTableColumn<TeamRow>[] = [
  {
    key: "newCustomers",
    header: "New customers",
    numeric: true,
    cell: ({ stats }) => (stats.kind === "site" ? "-" : stats.newCustomers),
  },
  {
    key: "quotations",
    header: "Quotations",
    numeric: true,
    cell: ({ stats }) => (stats.kind === "site" ? "-" : stats.quotations),
  },
  {
    key: "awarded",
    header: "Awarded",
    numeric: true,
    cell: ({ stats }) =>
      stats.kind === "site"
        ? "-"
        : `${stats.awardedCount} · ${formatRm(stats.awardedValue)}`,
  },
];

const siteColumns = (pace: number): DataTableColumn<TeamRow>[] => [
  {
    key: "shootings",
    header: "Shooting",
    numeric: true,
    cell: ({ stats }) =>
      stats.kind === "site" ? (
        <TargetProgress
          done={stats.shootings}
          target={stats.shootingTarget}
          pace={pace}
        />
      ) : (
        "-"
      ),
  },
  {
    key: "handovers",
    header: "Handover signed",
    numeric: true,
    cell: ({ stats }) =>
      stats.kind === "site" ? (
        <TargetProgress
          done={stats.handovers}
          target={stats.handoverTarget}
          pace={pace}
        />
      ) : (
        "-"
      ),
  },
  {
    key: "otHours",
    header: "OT hours",
    numeric: true,
    cell: ({ stats }) => (stats.kind === "site" ? stats.otHours : "-"),
  },
];

/** Everyone of one kind for the month: their figures against target and the state of their report. */
export function TeamTable({
  view,
  kind,
  rows,
  pace,
}: {
  view: ReportsView;
  kind: "sales" | "site";
  rows: TeamRow[];
  pace: number;
}) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      empty={
        <EmptyState
          icon={ClipboardList}
          title={
            kind === "sales" ? "No salespeople yet" : "No site supervisors yet"
          }
          description="People appear here once they are added with that job role."
        />
      }
      columns={[
        {
          key: "person",
          header: kind === "sales" ? "Salesperson" : "Site supervisor",
          cell: (row) => (
            <Link
              href={reportHref(view.basePath, view.month, {
                kind,
                person: row.id,
              })}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.name}
            </Link>
          ),
        },
        visitsColumn(pace),
        ...(kind === "sales" ? salesColumns : siteColumns(pace)),
        {
          key: "status",
          header: "Report",
          cell: (row) => {
            const flag = flagFor(view, row.report);
            return <StatusBadge tone={flag.tone}>{flag.label}</StatusBadge>;
          },
        },
      ]}
    />
  );
}
