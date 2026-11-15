import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { WeekList } from "@/components/app/week-list";
import {
  deliveryOrderNumber,
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
  missingDeliveryChecks,
} from "@/lib/domain/delivery-status";
import type { JobPeople } from "@/lib/domain/job-team";
import { type CalendarDate, formatDate } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { BookingCard } from "./booking-card";
import type { CalendarItem } from "./calendar-items";
import type { CalendarJob } from "./calendar-jobs";
import { JobDialog } from "./job-form";
import { JobStatusSelect } from "./job-status-select";

type Team = { id: string; name: string }[];

type JobListProps = {
  days: CalendarDate[];
  today: CalendarDate;
  eventsByDay: ReadonlyMap<CalendarDate, CalendarItem[]>;
  team: Team;
  /** For the job form's pickers; absent for people who cannot schedule. */
  people?: JobPeople;
  /** The signed-in person; a Site Supervisor moves only the jobs assigned to them. */
  meId: string;
  canSchedule: boolean;
  /** Only the MD may correct a DO no. the app issued. */
  canCorrectDoNo: boolean;
  canUpdateStatus: boolean;
  /** Whether the person may open the MOF register page the job belongs to. */
  canOpenMof: boolean;
  /** Whether the person answers bookings; they still only answer their own. */
  canAnswerBookings: boolean;
  addHref?: (date: CalendarDate) => string;
  emptyText?: string;
};

/** One row per day with a card per job or booking: the phone-friendly way to read the calendar. */
export function JobList({
  team,
  people,
  meId,
  canSchedule,
  canCorrectDoNo,
  canUpdateStatus,
  canOpenMof,
  canAnswerBookings,
  ...list
}: JobListProps) {
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  return (
    <WeekList
      {...list}
      renderEvent={(event) =>
        event.kind === "booking" ? (
          <BookingCard
            booking={event.booking}
            supervisor={nameOf.get(event.booking.supervisorId) ?? "Unnamed"}
            requester={nameOf.get(event.booking.requestedBy) ?? "Unnamed"}
            canAnswer={
              canAnswerBookings &&
              event.booking.status === "requested" &&
              event.booking.supervisorId === meId
            }
          />
        ) : (
          <JobCard
            job={event.job}
            supervisor={nameOf.get(event.job.siteSupervisorId)}
            team={team}
            people={people}
            canSchedule={canSchedule}
            canCorrectDoNo={canCorrectDoNo}
            canMove={
              canUpdateStatus &&
              (canSchedule || event.job.siteSupervisorId === meId)
            }
            canOpenMof={canOpenMof}
          />
        )
      }
    />
  );
}

type JobCardProps = {
  job: CalendarJob;
  supervisor: string | undefined;
  team: Team;
  people: JobPeople | undefined;
  canSchedule: boolean;
  canCorrectDoNo: boolean;
  canMove: boolean;
  canOpenMof: boolean;
};

function JobCard({
  job,
  supervisor,
  team,
  people,
  canSchedule,
  canCorrectDoNo,
  canMove,
  canOpenMof,
}: JobCardProps) {
  const number = job.order
    ? deliveryOrderNumber(job.mofNo, job.order.runningNo)
    : null;
  const title = `${job.mofNo} · ${job.companyName}`;
  const crew = [
    job.supervisorOnly ? "Supervisor only" : job.installer,
    supervisor,
  ]
    .filter(Boolean)
    .join(" · ");

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
            {number && (
              <>
                {" · "}
                <Link
                  href={`/installation/do/${job.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  Print DO
                </Link>
              </>
            )}
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
          {canSchedule && people && (
            <JobDialog
              mofId={job.mofId}
              mofNo={job.mofNo}
              job={job}
              team={team}
              people={people}
              defaultInstaller={job.mofInstaller}
              canCorrectDoNo={canCorrectDoNo}
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
