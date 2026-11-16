import { Percent } from "lucide-react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import type { CommissionSettings } from "@/lib/domain/commission-settings";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import { AppealDialog } from "../commission/appeal-dialog";
import { AppealPill } from "../commission/appeal-pill";
import { canSendAppeal } from "../commission/appeal-rules";
import { AdjustedNote } from "./adjusted-note";
import type { CommissionRow } from "./claim-commission-rows";
import { CommissionTick, TickAllButton } from "./commission-tick";

/** Section A: the person's commission lines at 90%+ paid, each ticked into the claim, with the late cut shown. */
export function CommissionSection({
  rows,
  month,
  editable,
  personId,
  rules,
  heading,
  t,
}: {
  rows: CommissionRow[];
  month: string;
  editable: boolean;
  personId: string;
  rules: CommissionSettings;
  heading: string;
  t: Translate;
}) {
  const untickedIds = rows.filter((row) => !row.ticked).map((row) => row.mofId);
  const columns: DataTableColumn<CommissionRow>[] = [
    ...(editable
      ? [
          {
            key: "tick",
            header: "",
            cell: (row: CommissionRow) => (
              <CommissionTick
                month={month}
                mofId={row.mofId}
                ticked={row.ticked}
                label={`${t("Claim")} ${row.mofNo}`}
              />
            ),
          },
        ]
      : []),
    {
      key: "project",
      header: t("Project"),
      cell: (row) => (
        <div className="flex min-w-40 flex-col items-start gap-1">
          <Link
            href={`/mofs/${row.mofId}`}
            className="font-mono font-medium hover:underline"
          >
            {row.mofNo}
          </Link>
          <span className="font-medium">{row.companyName}</span>
          <span className="text-xs text-muted-foreground">
            {row.projectName}
          </span>
          {row.option?.appeal && <AppealPill appeal={row.option.appeal} />}
        </div>
      ),
    },
    {
      key: "received",
      header: t("Received"),
      numeric: true,
      className: "max-sm:hidden",
      cell: (row) => (row.option ? `${row.option.pctPaid}%` : ""),
    },
    {
      key: "lateCut",
      header: t("Late cut"),
      numeric: true,
      cell: (row) => (
        <div className="flex flex-col items-end gap-1">
          <span className={row.lateCut > 0 ? "text-warn" : undefined}>
            {row.lateCut > 0 ? `-${formatRm(row.lateCut)}` : "—"}
          </span>
          {editable &&
            row.option &&
            canSendAppeal({
              linePersonId: personId,
              myId: personId,
              lateCut: row.lateCut,
              appealStatus: row.option.appeal?.status,
            }) && (
              <AppealDialog
                mofId={row.mofId}
                title={`${row.mofNo} · ${row.projectName}`}
                lateCut={row.lateCut}
                rejection={
                  row.option.appeal?.status === "rejected" &&
                  row.option.appeal.reply &&
                  row.option.appeal.decidedByName
                    ? {
                        reply: row.option.appeal.reply,
                        decidedByName: row.option.appeal.decidedByName,
                      }
                    : null
                }
              />
            )}
        </div>
      ),
    },
    {
      key: "claim",
      header: t("Claim"),
      numeric: true,
      cell: (row) => (
        <div>
          <b>{formatRm(row.amount)}</b>
          <AdjustedNote
            originalAmount={row.originalAmount}
            amount={row.amount}
            reason={row.adjustmentReason}
            t={t}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="font-heading text-lg font-semibold">{heading}</h2>
        <span className="text-sm text-muted-foreground">
          {t("Orders at 90%+ paid, not claimed yet")}
        </span>
        {editable && untickedIds.length > 1 && (
          <span className="ml-auto">
            <TickAllButton month={month} mofIds={untickedIds} />
          </span>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.mofId}
        empty={
          <EmptyState
            icon={Percent}
            title={t("Nothing ready to claim this month.")}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        {t("Late collection: money received more than")}{" "}
        {rules.firstLateCut.afterDays} {t("days after the invoice takes")}{" "}
        {rules.firstLateCut.cutPct}% {t("off the commission; more than")}{" "}
        {rules.secondLateCut.afterDays} {t("days takes")}{" "}
        {rules.secondLateCut.cutPct}%.{" "}
        {t(
          "If the client was difficult and you followed up, press Appeal. The MD or HR & Accounts may give a special approval, once.",
        )}
      </p>
    </section>
  );
}
