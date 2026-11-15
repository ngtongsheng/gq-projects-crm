import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import type { LeaveViewer } from "@/lib/domain/leave-approval";
import { needsSlip } from "@/lib/domain/leave-approval";
import type { LeaveBalance } from "@/lib/domain/leave-balance";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
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
  t,
}: {
  t: Translate;
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
      header: t("Person"),
      cell: (row) => (
        <div>
          <p className="font-semibold">{nameOf(row.personId)}</p>
          <p className="text-xs text-muted-foreground">
            {t("applied")} {formatDate(row.appliedOn)}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: t("Type"),
      cell: (row) => (
        <span className="whitespace-normal">
          {t(LEAVE_TYPE_LABEL[row.leaveType])}
        </span>
      ),
    },
    {
      key: "dates",
      header: t("Dates"),
      cell: (row) => (
        <span className="inline-block min-w-28 font-mono whitespace-normal tabular-nums">
          {leaveDates(row)}
        </span>
      ),
    },
    { key: "days", header: t("Days"), numeric: true, cell: (row) => row.days },
    {
      key: "reason",
      header: t("Reason"),
      cell: (row) => (
        <div className="min-w-40 whitespace-normal">
          <p>{row.reason || "—"}</p>
          <LeaveSlipCell row={row} viewer={viewer} t={t} />
        </div>
      ),
    },
    {
      key: "after",
      header: t("Balance after"),
      cell: (row) => {
        const after = balanceAfter(row.leaveType, row.days, balanceOf(row));
        if (after === null) return "—";
        return (
          <span className={after < 0 ? "font-medium text-bad" : undefined}>
            {after} {t("days")}
            {after < 0 ? ` (${t("over")})` : ""}
          </span>
        );
      },
    },
    {
      key: "away",
      header: t("Also away"),
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
