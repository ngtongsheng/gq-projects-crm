import Link from "next/link";
import type { CalendarEvent } from "@/components/app/calendar-event";
import { StatusBadge } from "@/components/app/status-badge";
import { WeekList } from "@/components/app/week-list";
import {
  deliveryOrderNumber,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
  missingDeliveryChecks,
} from "@/lib/domain/delivery-status";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import type { CalendarJob } from "./calendar-jobs";
import { JobDialog } from "./job-form";
import { JobStatusSelect } from "./job-status-select";

/** A job on the calendar: the compact event for the grid, plus the job for the list card. */
export type JobEvent = CalendarEvent & { job: CalendarJob };

type Team = { id: string; name: string }[];

type JobListProps = {
  days: CalendarDate[];
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, JobEvent[]>;
  team: Team;
  /** The signed-in person; a Site Supervisor moves only the jobs assigned to them. */
  meId: string;
  canSchedule: boolean;
  canUpdateStatus: boolean;
  /** Whether the person may open the MOF register page the job belongs to. */
  canOpenMof: boolean;
  addHref?: (date: CalendarDate) => string;
  emptyText?: string;
};

/** One row per day with a card per job: the phone-friendly way to read the calendar. */
export function JobList({
  team,
  meId,
  canSchedule,
  canUpdateStatus,
  canOpenMof,
  ...list
}: JobListProps) {
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  return (
    <WeekList
      {...list}
      renderEvent={({ job }) => (
        <JobCard
          job={job}
          supervisor={nameOf.get(job.siteSupervisorId)}
          team={team}
          canSchedule={canSchedule}
          canMove={
            canUpdateStatus && (canSchedule || job.siteSupervisorId === meId)
          }
          canOpenMof={canOpenMof}
        />
      )}
    />
  );
}

type JobCardProps = {
  job: CalendarJob;
  supervisor: string | undefined;
  team: Team;
  canSchedule: boolean;
  canMove: boolean;
  canOpenMof: boolean;
};

function JobCard({
  job,
  supervisor,
  team,
  canSchedule,
  canMove,
  canOpenMof,
}: JobCardProps) {
  const number = job.order
    ? deliveryOrderNumber(job.mofNo, job.order.runningNo)
    : null;
  const title = `${job.mofNo} · ${job.companyName}`;
  const crew = [job.installer, supervisor].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3 text-sm",
        job.status === "postponed" && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {job.startTime || "All day"}
        </span>
        <StatusBadge tone={JOB_STATUS_TONE[job.status]}>
          {JOB_STATUS_LABEL[job.status]}
        </StatusBadge>
      </div>
      <div className="min-w-0">
        {canOpenMof ? (
          <Link
            href={`/mofs/${job.mofId}`}
            className="font-medium hover:underline"
          >
            {title}
          </Link>
        ) : (
          <p className="font-medium">{title}</p>
        )}
        <p className="text-muted-foreground">
          {JOB_TYPE_LABEL[job.jobType]} · {job.projectName}
        </p>
        {job.endsOn !== job.scheduledOn && (
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {formatDate(job.scheduledOn)} – {formatDate(job.endsOn)}
          </p>
        )}
        {crew && <p className="text-muted-foreground">{crew}</p>}
        {job.jobType === "delivery" && (
          <p className="text-muted-foreground">
            DO{" "}
            <span className="font-mono tabular-nums">
              {number ?? "not issued"}
            </span>
          </p>
        )}
        {job.notes && <p className="text-muted-foreground">{job.notes}</p>}
      </div>
      {(canMove || canSchedule) && (
        <div className="flex flex-wrap items-center gap-2">
          {canMove && (
            <JobStatusSelect
              mofId={job.mofId}
              jobId={job.id}
              status={job.status}
            />
          )}
          {canSchedule && (
            <JobDialog
              mofId={job.mofId}
              mofNo={job.mofNo}
              job={job}
              team={team}
              defaultInstaller={job.mofInstaller}
              missingChecks={missingDeliveryChecks({
                paymentChecked: job.paymentChecked,
                dosPreApproved: job.dosPreApproved,
              })}
            />
          )}
        </div>
      )}
    </div>
  );
}
