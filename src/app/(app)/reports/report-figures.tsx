import { DataTable } from "@/components/app/data-table";
import { StatusBadge } from "@/components/app/status-badge";
import { achievedTone, type ReportStats } from "@/lib/domain/report-stats";
import {
  type ItineraryLine,
  type ItineraryOrigin,
  ORIGIN_LABEL,
  type ShootingHandoverRow,
  type SiteReport,
  scheduleCheckSummary,
  shootingHandoverWords,
  stockReturnSummary,
} from "@/lib/domain/site-report";
import { formatDate } from "@/lib/format/date";
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

const ORIGIN_TONE: Record<
  ItineraryOrigin,
  "good" | "info" | "warn" | "bad" | "neutral"
> = {
  as_planned: "good",
  added: "info",
  not_logged: "bad",
  upcoming: "neutral",
};

/** The site report's itinerary, schedule check, shooting and handover table, and stock returns. */
export function SiteReportSections({
  report,
  visitTarget,
}: {
  report: SiteReport;
  visitTarget: number;
}) {
  const { itinerary, shootingHandover, stockReturns } = report;
  const { counts } = itinerary;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Itinerary · {counts.visits}/{visitTarget} site visits
        </h2>
        <p className="text-sm text-muted-foreground">
          {scheduleCheckSummary(counts)}
        </p>
        <DataTable<ItineraryLine>
          rows={itinerary.lines}
          getRowKey={(line) => `${line.day}|${line.siteLabel}`}
          empty={
            <p className="p-4 text-sm text-muted-foreground">
              No site visits or bookings this month.
            </p>
          }
          columns={[
            {
              key: "day",
              header: "Date",
              numeric: true,
              cell: (line) => formatDate(line.day),
            },
            {
              key: "site",
              header: "Site",
              cell: (line) => (
                <span className="font-medium">{line.siteLabel}</span>
              ),
            },
            {
              key: "work",
              header: "Work",
              className: "max-sm:hidden",
              cell: (line) => line.work.join(", "),
            },
            {
              key: "origin",
              header: "Scheduled or added",
              cell: (line) => (
                <StatusBadge tone={ORIGIN_TONE[line.origin]}>
                  {ORIGIN_LABEL[line.origin]}
                </StatusBadge>
              ),
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Shooting and handover
        </h2>
        <DataTable<ShootingHandoverRow>
          rows={shootingHandover}
          getRowKey={(row) => `${row.day}|${row.siteLabel}|${row.activity}`}
          empty={
            <p className="p-4 text-sm text-muted-foreground">
              No shootings or handovers this month.
            </p>
          }
          columns={[
            {
              key: "day",
              header: "Date",
              numeric: true,
              cell: (row) => formatDate(row.day),
            },
            {
              key: "site",
              header: "Site",
              cell: (row) => (
                <span className="font-medium">{row.siteLabel}</span>
              ),
            },
            {
              key: "activity",
              header: "Work",
              cell: (row) => shootingHandoverWords(row).work,
            },
            {
              key: "result",
              header: "Result",
              cell: (row) => (
                <StatusBadge tone={row.done ? "good" : "warn"}>
                  {shootingHandoverWords(row).result}
                </StatusBadge>
              ),
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold">Stock returns</h2>
        <p className="text-sm text-muted-foreground">
          {stockReturnSummary(stockReturns)}
        </p>
      </section>
    </>
  );
}
