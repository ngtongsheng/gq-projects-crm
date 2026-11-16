import { Moon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import {
  OT_CLAIM_TYPE_LABEL,
  OT_STATUS_LABEL,
  OT_STATUS_TONE,
} from "@/lib/domain/ot-claim";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { DecisionButtons } from "../overtime/decision-buttons";
import { OtClaimDialog } from "../overtime/ot-claim-dialog";
import type { MofOption, OtClaim } from "../overtime/overtime-data";
import type { loadClaimOvertime } from "./claim-ot-data";

type Overtime = Awaited<ReturnType<typeof loadClaimOvertime>>;

/** Section C (D3): the month's overtime and replacement leave, folded into the claim. Approved OT is paid, replacement leave is not. */
export function OvertimeSection({
  overtime,
  amount,
  editable,
  canDecide = false,
  mofs,
  today,
  heading,
  t,
}: {
  overtime: Overtime;
  /** The OT amount in the claim: frozen at submit, else the database's figure for the month. */
  amount: number | null;
  editable: boolean;
  /** The viewer may approve or reject the pending entries: a decider looking at someone else's claim. */
  canDecide?: boolean;
  mofs: MofOption[];
  today: string;
  heading: string;
  t: Translate;
}) {
  const { entries, hours } = overtime;
  const columns: DataTableColumn<OtClaim>[] = [
    {
      key: "date",
      header: t("Date"),
      cell: (entry) => (
        <span className="font-mono whitespace-nowrap tabular-nums">
          {formatDate(entry.workDate)}
        </span>
      ),
    },
    {
      key: "site",
      header: t("Project / site and reason"),
      cell: (entry) => (
        <div className="min-w-40">
          {entry.mofNo} · {entry.projectName}
          <span className="block text-xs text-muted-foreground">
            {entry.reason}
          </span>
        </div>
      ),
    },
    {
      key: "time",
      header: t("Time"),
      className: "max-sm:hidden",
      cell: (entry) => (
        <span className="font-mono tabular-nums">
          {entry.fromTime}–{entry.toTime}
        </span>
      ),
    },
    { key: "hours", header: t("Hours"), numeric: true, cell: (e) => e.hours },
    {
      key: "askedAs",
      header: t("Asked as"),
      className: "max-sm:hidden",
      cell: (entry) => t(OT_CLAIM_TYPE_LABEL[entry.claimAs]),
    },
    {
      key: "decision",
      header: t("Decision"),
      cell: (entry) => (
        <StatusBadge tone={OT_STATUS_TONE[entry.status]}>
          {entry.status === "approved" && entry.approvedAs
            ? t(OT_CLAIM_TYPE_LABEL[entry.approvedAs])
            : t(OT_STATUS_LABEL[entry.status])}
        </StatusBadge>
      ),
    },
    ...(canDecide
      ? [
          {
            key: "decide",
            header: "",
            cell: (entry: OtClaim) =>
              entry.status === "pending" ? (
                <DecisionButtons claimId={entry.id} />
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">{heading}</h2>
        <span className="text-sm text-muted-foreground">
          {hours.ot} {t("hrs OT claim")} · {hours.replacementLeave}{" "}
          {t("hrs replacement leave")}
          {hours.pending > 0 && ` · ${hours.pending} ${t("hrs waiting")}`}
          {amount !== null &&
            amount > 0 &&
            ` · ${t("OT amount")} ${formatRm(amount)}`}
        </span>
        {editable && (
          <span className="ml-auto">
            <OtClaimDialog mofs={mofs} today={today} />
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={entries}
        getRowKey={(entry) => entry.id}
        empty={
          <EmptyState
            icon={Moon}
            title={t("No overtime in this claim month.")}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        {t(
          "Night or weekend work. The director, MD or HR & Accounts approves each entry as an OT claim (paid) or replacement leave. Approved OT claim hours go to HR & Accounts with this claim.",
        )}
      </p>
    </section>
  );
}
