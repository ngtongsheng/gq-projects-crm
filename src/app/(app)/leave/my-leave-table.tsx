import { CalendarOff } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { canCancelLeave, type LeaveViewer } from "@/lib/domain/leave-approval";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { LeaveStatusBadge } from "./leave-badges";
import { CancelLeaveButton } from "./leave-row-actions";
import { LeaveSlipCell } from "./leave-slip-cell";
import { type LeaveRow, leaveDates } from "./leave-view";

/** The person's own leave for the year: dates, days, status, who decided, and Cancel while it can be. */
export function MyLeaveTable({
  rows,
  viewer,
  today,
  nameOf,
  t,
}: {
  t: Translate;
  rows: LeaveRow[];
  viewer: LeaveViewer;
  today: CalendarDate;
  nameOf: (personId: string) => string;
}) {
  const columns: DataTableColumn<LeaveRow>[] = [
    {
      key: "type",
      header: t("Type"),
      cell: (row) => t(LEAVE_TYPE_LABEL[row.leaveType]),
    },
    {
      key: "dates",
      header: t("Dates"),
      cell: (row) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          {leaveDates(row)}
        </span>
      ),
    },
    { key: "days", header: t("Days"), numeric: true, cell: (row) => row.days },
    {
      key: "reason",
      header: t("Reason"),
      cell: (row) => (
        <div className="min-w-40">
          <p>{row.reason || "—"}</p>
          <LeaveSlipCell row={row} viewer={viewer} t={t} />
        </div>
      ),
    },
    {
      key: "status",
      header: t("Status"),
      cell: (row) => (
        <div className="flex flex-col items-start gap-1">
          <LeaveStatusBadge status={row.status} t={t} />
          {row.decidedById && row.decidedOn && (
            <span className="text-xs text-muted-foreground">
              {nameOf(row.decidedById)} · {formatDate(row.decidedOn)}
              {row.decisionNote ? ` · ${row.decisionNote}` : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) =>
        canCancelLeave(row, viewer, today) ? (
          <CancelLeaveButton leaveId={row.id} />
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      empty={
        <EmptyState icon={CalendarOff} title={t("No leave yet this year.")} />
      }
    />
  );
}
