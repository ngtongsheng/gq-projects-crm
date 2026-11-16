import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeliveredEarlier, DoLine } from "@/lib/domain/delivery-order";
import {
  DELIVERY_STATUS_TONE,
  deliveryOrderNumber,
  deliveryStatus,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
} from "@/lib/domain/delivery-status";
import type { JobPeople } from "@/lib/domain/job-team";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { CancelDoButton } from "../../installation/cancel-do-button";
import {
  DoLinesDialog,
  type OrderedProduct,
} from "../../installation/do-lines-dialog";
import { JobDialog, type JobRow } from "../../installation/job-form";

type DeliveryJobsProps = {
  t: Translate;
  mofId: string;
  mofNo: string;
  jobs: JobRow[];
  team: { id: string; name: string }[];
  /** For the job form's pickers; absent for people who cannot schedule. */
  people?: JobPeople;
  defaultInstaller: string;
  missingChecks: string[];
  canSchedule: boolean;
  /** Only the MD may correct a DO no. the app issued. */
  canCorrectDoNo: boolean;
  /** The items on each delivery's DO, by job id. */
  doLines: Map<string, DoLine[]>;
  /** What the MOF's other DOs delivered, by job id; loaded for people who edit DOs. */
  earlierByJob: Map<string, DeliveredEarlier[]>;
  ordered: OrderedProduct[];
};

/** The MOF's delivery, installation and measurement jobs, with where delivery stands. */
export function DeliveryJobs({
  t,
  mofId,
  mofNo,
  jobs,
  team,
  people,
  defaultInstaller,
  missingChecks,
  canSchedule,
  canCorrectDoNo,
  doLines,
  earlierByJob,
  ordered,
}: DeliveryJobsProps) {
  const delivery = deliveryStatus(
    jobs
      .filter((job) => job.jobType === "delivery")
      .map((job) => ({
        status: job.status,
        isFinal: job.order?.isFinal ?? false,
      })),
  );
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const dialog =
    canSchedule && people
      ? {
          mofId,
          mofNo,
          team,
          people,
          defaultInstaller,
          missingChecks,
          canCorrectDoNo,
        }
      : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading">
            {t("Delivery & installation")}
          </CardTitle>
          <div>
            <StatusBadge tone={DELIVERY_STATUS_TONE[delivery.state]}>
              {t(delivery.label)}
            </StatusBadge>
          </div>
        </div>
        {dialog && <JobDialog {...dialog} />}
      </CardHeader>
      <CardContent>
        <DataTable
          rows={jobs}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title={t("Nothing scheduled")}
              description={t(
                "Schedule deliveries, installations and site measurements here.",
              )}
            />
          }
          columns={[
            {
              key: "type",
              header: t("Job"),
              cell: (row) => t(JOB_TYPE_LABEL[row.jobType]),
            },
            {
              key: "dates",
              header: t("Dates"),
              numeric: true,
              cell: (row) => (
                <span className="whitespace-normal">
                  {formatDate(row.scheduledOn)}
                  {row.endsOn !== row.scheduledOn &&
                    ` – ${formatDate(row.endsOn)}`}
                  {row.startTime && ` · ${row.startTime}`}
                </span>
              ),
            },
            {
              key: "who",
              header: t("Team"),
              cell: (row) => (
                <div className="flex flex-col">
                  <span>
                    {row.supervisorOnly
                      ? t("Supervisor only")
                      : row.installer || "–"}
                  </span>
                  {row.siteSupervisorId && (
                    <span className="text-sm text-muted-foreground">
                      {nameOf.get(row.siteSupervisorId) ?? t("Unnamed")}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "order",
              header: t("DO"),
              cell: (row) => {
                if (!row.order) return "–";
                const number = deliveryOrderNumber(mofNo, row.order.runningNo);
                return (
                  <div className="flex max-w-72 flex-col whitespace-normal">
                    <span className="font-mono font-medium">
                      {number ?? t("Not issued")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[
                        row.order.transporter,
                        row.order.isFinal ? t("Final") : t("Partial"),
                        row.order.signedReturned
                          ? t("signed and returned")
                          : t("not yet returned"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {row.order.items && (
                      <span className="text-sm text-muted-foreground">
                        {row.order.items}
                      </span>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {number && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/installation/do/${row.id}`}>
                            {t("Print DO")}
                          </Link>
                        </Button>
                      )}
                      {dialog && (
                        <DoLinesDialog
                          mofId={mofId}
                          mofNo={mofNo}
                          jobId={row.id}
                          lines={doLines.get(row.id) ?? []}
                          ordered={ordered}
                          earlier={earlierByJob.get(row.id) ?? []}
                        />
                      )}
                      {dialog && number && row.status !== "postponed" && (
                        <CancelDoButton
                          mofId={mofId}
                          jobId={row.id}
                          doNo={number}
                        />
                      )}
                    </div>
                  </div>
                );
              },
            },
            {
              key: "status",
              header: t("Status"),
              cell: (row) => (
                <StatusBadge tone={JOB_STATUS_TONE[row.status]}>
                  {t(JOB_STATUS_LABEL[row.status])}
                </StatusBadge>
              ),
            },
            {
              key: "notes",
              header: t("Remarks"),
              cell: (row) => (
                <span className="block max-w-56 whitespace-normal">
                  {row.notes || "–"}
                </span>
              ),
            },
            ...(dialog
              ? [
                  {
                    key: "edit",
                    header: "",
                    cell: (row: JobRow) => <JobDialog {...dialog} job={row} />,
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}
