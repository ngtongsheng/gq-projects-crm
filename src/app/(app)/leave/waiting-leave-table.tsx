import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import type { LeaveViewer } from "@/lib/domain/leave-approval";
import { needsSlip } from "@/lib/domain/leave-approval";
import type { LeaveBalance } from "@/lib/domain/leave-balance";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import { formatDate } from "@/lib/format/date";
import { DecisionButtons } from "./leave-row-actions";
import { LeaveSlipCell } from "./leave-slip-cell";
import {
  alsoAway,
  balanceAfter,
  type LeaveRow,
  leaveDates,
} from "./leave-view";

/** Leave waiting on this person: balance after it, who else is away, and Reject / Approve. */
export function WaitingLeaveTable({
  rows,
  allRows,
  viewer,
  nameOf,
  balanceOf,
}: {
  rows: LeaveRow[];
  /** Every leave the viewer can read, for "Also away". */
  allRows: LeaveRow[];
  viewer: LeaveViewer;
  nameOf: (personId: string) => string;
  /** The applicant's balance for the year the leave starts in. */
  balanceOf: (row: LeaveRow) => LeaveBalance | null;
}) {
  const columns: DataTableColumn<LeaveRow>[] = [
    {
      key: "person",
      header: "Person",
      cell: (row) => (
        <div>
          <p className="font-semibold">{nameOf(row.personId)}</p>
          <p className="text-xs text-muted-foreground">
            applied {formatDate(row.appliedOn)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => LEAVE_TYPE_LABEL[row.leaveType],
    },
    {
      key: "dates",
      header: "Dates",
      cell: (row) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          {leaveDates(row)}
        </span>
      ),
    },
    { key: "days", header: "Days", numeric: true, cell: (row) => row.days },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => (
        <div className="min-w-40">
          <p>{row.reason || "—"}</p>
          <LeaveSlipCell row={row} viewer={viewer} />
        </div>
      ),
    },
    {
      key: "after",
      header: "Balance after",
      cell: (row) => {
        const after = balanceAfter(row.leaveType, row.days, balanceOf(row));
        if (after === null) return "—";
        return (
          <span className={after < 0 ? "font-medium text-bad" : undefined}>
            {after} days{after < 0 ? " (over)" : ""}
          </span>
        );
      },
    },
    {
      key: "away",
      header: "Also away",
      cell: (row) => {
        const names = alsoAway(row, allRows).map(nameOf);
        return names.length > 0 ? names.join(", ") : "—";
      },
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <DecisionButtons
          leaveId={row.id}
          personName={nameOf(row.personId)}
          isMc={needsSlip(row.leaveType)}
        />
      ),
    },
  ];

  return (
    <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} />
  );
}
