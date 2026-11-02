import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { achievedTone, type ReportStats } from "@/lib/domain/report-stats";
import { formatRm } from "@/lib/format/money";

type FigureRow = {
  label: string;
  target: number | null;
  actual: string;
  /** For rows with a target: the count compared with it. */
  done?: number;
};

function rowsFor(stats: ReportStats): FigureRow[] {
  if (stats.kind === "site") {
    return [
      {
        label: "Site visits",
        target: stats.siteVisitTarget,
        actual: String(stats.siteVisits),
        done: stats.siteVisits,
      },
      {
        label: "Photo / video shooting",
        target: stats.shootingTarget,
        actual: String(stats.shootings),
        done: stats.shootings,
      },
      {
        label: "Handover forms signed",
        target: stats.handoverTarget,
        actual: String(stats.handovers),
        done: stats.handovers,
      },
      { label: "Overtime hours", target: null, actual: String(stats.otHours) },
    ];
  }
  const rows: FigureRow[] = [
    {
      label: "Customer visits",
      target: stats.visitTarget,
      actual: String(stats.visits),
      done: stats.visits,
    },
    {
      label: "New customers met",
      target: null,
      actual: String(stats.newCustomers),
    },
    {
      label: "Quotations issued",
      target: null,
      actual: String(stats.quotations),
    },
    {
      label: "Projects awarded",
      target: null,
      actual: `${stats.awardedCount} · ${formatRm(stats.awardedValue)}`,
    },
  ];
  if (stats.kind === "bd") {
    rows.push({
      label: "BD pass-down sales",
      target: null,
      actual: `${stats.passDownCount} · ${formatRm(stats.passDownValue)}`,
    });
  }
  return rows;
}

/** The month's figures against target. `pace` is the share of the month's workdays gone. */
export function ReportFigures({
  stats,
  pace,
}: {
  stats: ReportStats;
  pace: number;
}) {
  return (
    <DataTable
      rows={rowsFor(stats)}
      getRowKey={(row) => row.label}
      columns={[
        {
          key: "label",
          header: "Measure",
          cell: (row) => <span className="font-medium">{row.label}</span>,
        },
        {
          key: "target",
          header: "Target",
          numeric: true,
          cell: (row) => (row.target === null ? "-" : row.target),
        },
        {
          key: "actual",
          header: "Actual",
          numeric: true,
          cell: (row) => row.actual,
        },
        {
          key: "achieved",
          header: "Achieved",
          numeric: true,
          cell: (row) =>
            row.target === null || row.done === undefined ? (
              "-"
            ) : row.target === 0 ? (
              "No target set"
            ) : (
              <StatusBadge tone={achievedTone(row.done, row.target, pace)}>
                {Math.round((row.done / row.target) * 100)}%
              </StatusBadge>
            ),
        },
      ]}
    />
  );
}
