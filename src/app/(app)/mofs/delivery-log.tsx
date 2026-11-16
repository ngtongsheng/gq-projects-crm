import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DELIVERY_STATUS_TONE,
  JOB_STATUS_LABEL,
} from "@/lib/domain/delivery-status";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { DoNumberingDialog } from "../installation/do-numbering-dialog";
import type { CancelledDoNumber, DeliveryLogRow } from "./delivery-log-data";
import { JobScopeLabel } from "./schemas";

type DeliveryLogProps = {
  t: Translate;
  rows: DeliveryLogRow[];
  cancelled: CancelledDoNumber[];
  nextNo: string;
  today: string;
  canSchedule: boolean;
  canSetNextNo: boolean;
};

/** One line per DO on the MOF register (demo: Delivery log, 14 columns). */
export function DeliveryLog({
  t,
  rows,
  cancelled,
  nextNo,
  today,
  canSchedule,
  canSetNextNo,
}: DeliveryLogProps) {
  const notSigned = rows.filter(
    (row) => row.jobStatus === "done" && !row.signedReturned,
  ).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-heading text-base font-medium">
          {t("Delivery log")}
        </h2>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          {rows.length} {t("DOs ·")} {notSigned}{" "}
          {t("delivered, not yet signed · next running no.")}{" "}
          <b className="text-foreground">{nextNo}</b>
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canSetNextNo && (
            <DoNumberingDialog nextNo={nextNo} triggerLabel="Change" />
          )}
          {canSchedule && (
            <Button asChild size="sm">
              <Link href={`/installation?add=${today}`}>
                {t("Schedule delivery")}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.jobId}
        empty={
          <EmptyState
            title={t("No deliveries yet")}
            description={t("A delivery appears here once it is scheduled.")}
          />
        }
        columns={[
          {
            key: "doNo",
            header: t("DO no."),
            cell: (row) =>
              row.doNo ? (
                <div className="flex flex-col">
                  <span className="font-mono font-medium">{row.runningNo}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.doNo}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">
                  {t("No DO no. yet")}
                </span>
              ),
          },
          {
            key: "mofNo",
            header: t("MOF no."),
            cell: (row) => (
              <div className="flex flex-col">
                <Link
                  href={`/mofs/${row.mofId}`}
                  className="font-mono font-medium hover:underline"
                >
                  {row.mofNo}
                </Link>
                {row.position && (
                  <span className="text-xs text-muted-foreground">
                    {row.position}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "company",
            header: t("Company"),
            cell: (row) => row.companyName,
          },
          {
            key: "project",
            header: t("Project"),
            cell: (row) => row.projectName,
          },
          {
            key: "doDate",
            header: t("DO date"),
            numeric: true,
            cell: (row) => (
              <div className="flex flex-col items-end gap-1">
                <span>{formatDate(row.doDate)}</span>
                {row.jobStatus !== "done" && (
                  <StatusBadge tone="info">
                    {t(JOB_STATUS_LABEL[row.jobStatus])}
                  </StatusBadge>
                )}
              </div>
            ),
          },
          {
            key: "transporter",
            header: t("Transporter"),
            cell: (row) => row.transporter || "–",
          },
          {
            key: "scope",
            header: t("Job scope"),
            cell: (row) => JobScopeLabel[row.scope],
          },
          {
            key: "final",
            header: t("Partial / full"),
            cell: (row) => (
              <StatusBadge tone={row.isFinal ? "good" : "warn"}>
                {row.isFinal ? t("Full / final") : t("Partial")}
              </StatusBadge>
            ),
          },
          {
            key: "supplier",
            header: t("DO passed to supplier"),
            cell: (row) => (row.passedToSupplier ? t("Yes") : t("No")),
          },
          {
            key: "signed",
            header: t("DO signed & returned"),
            cell: (row) => {
              if (row.signedReturned) return t("Yes");
              return row.jobStatus === "done" ? (
                <StatusBadge tone="bad">{t("No")}</StatusBadge>
              ) : (
                "–"
              );
            },
          },
          {
            key: "items",
            header: t("Items"),
            cell: (row) => (
              <span className="block max-w-56 whitespace-normal">
                {row.items || "–"}
              </span>
            ),
          },
          {
            key: "remarks",
            header: t("Remarks"),
            cell: (row) => (
              <span className="block max-w-48 whitespace-normal">
                {row.remarks}
              </span>
            ),
          },
          {
            key: "delivered",
            header: t("Project delivered?"),
            cell: (row) => (
              <StatusBadge tone={DELIVERY_STATUS_TONE[row.delivery.state]}>
                {t(row.delivery.label)}
              </StatusBadge>
            ),
          },
          {
            key: "print",
            header: "",
            cell: (row) =>
              row.doNo ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/installation/do/${row.jobId}`}>
                    {t("Print DO")}
                  </Link>
                </Button>
              ) : null,
          },
        ]}
      />
      {cancelled.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <b className="text-foreground">{t("Cancelled DO numbers")}</b>{" "}
          {t("(never reused):")}{" "}
          {cancelled
            .map(
              (number) =>
                `${number.doNo} (${formatDateTime(number.cancelledOn)}${number.cancelledBy ? `, ${number.cancelledBy}` : ""})`,
            )
            .join(" · ")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t(
          "One line per DO. Each delivery gets the next running number when you tick Issue DO no. now; it is shown in full as the MOF no. and the running no. Mark each DO Partial or Full / final: Project delivered? turns to Fully delivered once a final DO is delivered. Cancelling a DO that has a number postpones the delivery and the number is never used again.",
        )}
      </p>
    </section>
  );
}
