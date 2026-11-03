import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DELIVERY_STATUS_TONE,
  deliveryOrderNumber,
  deliveryStatus,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
} from "@/lib/domain/delivery-status";
import { formatDate } from "@/lib/format/date";
import { JobDialog, type JobRow } from "../../installation/job-form";

type DeliveryJobsProps = {
  mofId: string;
  mofNo: string;
  jobs: JobRow[];
  team: { id: string; name: string }[];
  defaultInstaller: string;
  missingChecks: string[];
  canSchedule: boolean;
};

/** The MOF's delivery, installation and measurement jobs, with where delivery stands. */
export function DeliveryJobs({
  mofId,
  mofNo,
  jobs,
  team,
  defaultInstaller,
  missingChecks,
  canSchedule,
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
  const dialog = { mofId, mofNo, team, defaultInstaller, missingChecks };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading">
            Delivery &amp; installation
          </CardTitle>
          <div>
            <StatusBadge tone={DELIVERY_STATUS_TONE[delivery.state]}>
              {delivery.label}
            </StatusBadge>
          </div>
        </div>
        {canSchedule && <JobDialog {...dialog} />}
      </CardHeader>
      <CardContent>
        <DataTable
          rows={jobs}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              title="Nothing scheduled"
              description="Schedule deliveries, installations and site measurements here."
            />
          }
          columns={[
            {
              key: "type",
              header: "Job",
              cell: (row) => JOB_TYPE_LABEL[row.jobType],
            },
            {
              key: "dates",
              header: "Dates",
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
              header: "Team",
              cell: (row) => (
                <div className="flex flex-col">
                  <span>{row.installer || "–"}</span>
                  {row.siteSupervisorId && (
                    <span className="text-sm text-muted-foreground">
                      {nameOf.get(row.siteSupervisorId) ?? "Unnamed"}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "order",
              header: "DO",
              cell: (row) => {
                if (!row.order) return "–";
                const number = deliveryOrderNumber(mofNo, row.order.runningNo);
                return (
                  <div className="flex max-w-72 flex-col whitespace-normal">
                    <span className="font-mono font-medium">
                      {number ?? "Not issued"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[
                        row.order.transporter,
                        row.order.isFinal ? "Final" : "Partial",
                        row.order.signedReturned
                          ? "signed and returned"
                          : "not yet returned",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {row.order.items && (
                      <span className="text-sm text-muted-foreground">
                        {row.order.items}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => (
                <StatusBadge tone={JOB_STATUS_TONE[row.status]}>
                  {JOB_STATUS_LABEL[row.status]}
                </StatusBadge>
              ),
            },
            {
              key: "notes",
              header: "Note",
              cell: (row) => (
                <span className="block max-w-56 whitespace-normal">
                  {row.notes || "–"}
                </span>
              ),
            },
            ...(canSchedule
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
