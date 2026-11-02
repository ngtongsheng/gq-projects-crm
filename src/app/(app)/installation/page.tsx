import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { MonthCalendar } from "@/components/app/month-calendar";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { canScheduleJobs, canUpdateJobStatus } from "@/lib/auth/job-role";
import { allowedSectionsFor, canOpenSection } from "@/lib/auth/nav-sections";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  formatMonthTitle,
  isSameMonth,
  monthWeeks,
  weekDays,
} from "@/lib/domain/calendar-grid";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_TONE,
  JOB_TYPE_LABEL,
} from "@/lib/domain/delivery-status";
import { jobsByDay } from "@/lib/domain/job-calendar";
import { formatDate, todayMyt } from "@/lib/format/date";
import {
  calendarHref,
  parseCalendarParams,
  stepDate,
} from "../calendar/calendar-params";
import { AddJobDialog } from "./add-job-dialog";
import { loadCalendarJobs } from "./calendar-jobs";
import { type JobEvent, JobList } from "./job-list";
import { loadMofOptions } from "./mof-options";

export const metadata: Metadata = { title: "Installation" };

const PATH = "/installation";
const NOUN = { one: "job", many: "jobs" };

export default async function InstallationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("installation");
  const params = parseCalendarParams(await searchParams);
  const { view } = params;
  const today = todayMyt();
  const canSchedule = canScheduleJobs(me.jobRole);
  const title =
    allowedSectionsFor(me.jobRole).find((s) => s.key === "installation")
      ?.label ?? "Installation";

  const weeks = view === "month" ? monthWeeks(params.date) : null;
  const days = weeks ? weeks.flat() : weekDays(params.date);
  const from = days[0];
  const to = days[days.length - 1];

  const [jobs, team, mofs] = await Promise.all([
    // A Site Supervisor sees their own jobs; everyone else sees the whole schedule.
    loadCalendarJobs(from, to, me.jobRole === "site" ? me.id : null),
    getTeamDirectory(),
    canSchedule && params.add ? loadMofOptions() : Promise.resolve(null),
  ]);

  const keep = { view };
  const here = { ...keep, date: params.date };
  const href = (next: Parameters<typeof calendarHref>[0]) =>
    calendarHref(next, PATH);

  const eventsByDay = new Map<string, JobEvent[]>();
  for (const [day, dayJobs] of jobsByDay(jobs, from, to)) {
    eventsByDay.set(
      day,
      dayJobs.map((job) => ({
        id: job.id,
        time: job.startTime || "All day",
        title: `${job.mofNo} · ${job.companyName}`,
        detail: `${JOB_TYPE_LABEL[job.jobType]} · ${JOB_STATUS_LABEL[job.status]}`,
        tone: JOB_STATUS_TONE[job.status],
        href: href({ view: "week", date: day }),
        muted: job.status === "postponed",
        job,
      })),
    );
  }

  // The month grid needs room, so a phone gets a list of the days that have jobs instead.
  const listDays = weeks
    ? days.filter(
        (day) => isSameMonth(day, params.date) && eventsByDay.has(day),
      )
    : days;
  const inProgress = jobs.filter((job) => job.status === "in_progress").length;
  const periodTitle = weeks
    ? formatMonthTitle(params.date)
    : `${formatDate(from)} – ${formatDate(to)}`;
  const addHref = canSchedule
    ? (date: string) => href({ ...here, add: date })
    : undefined;

  const list = (
    <JobList
      days={listDays}
      today={today}
      eventsByDay={eventsByDay}
      team={team}
      meId={me.id}
      canSchedule={canSchedule}
      canUpdateStatus={canUpdateJobStatus(me.jobRole)}
      canOpenMof={canOpenSection(me.jobRole, "mof")}
      addHref={view === "week" ? addHref : undefined}
      emptyText="No jobs."
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={`${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} · ${inProgress} in progress this ${weeks ? "month" : "week"}${me.jobRole === "site" ? " · yours" : ""}`}
        actions={
          <>
            <div className="inline-flex gap-1">
              <Button
                asChild
                size="sm"
                variant={view === "month" ? "default" : "outline"}
              >
                <Link href={href({ ...here, view: "month" })}>Month</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={view === "week" ? "default" : "outline"}
              >
                <Link href={href({ ...here, view: "week" })}>Week</Link>
              </Button>
            </div>
            {addHref && (
              <Button asChild size="sm">
                <Link href={addHref(today)}>
                  <Plus data-icon="inline-start" />
                  Schedule job
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href({ ...keep, date: stepDate(view, params.date, -1) })}
            aria-label={view === "month" ? "Previous month" : "Previous week"}
          >
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href({ ...keep, date: stepDate(view, params.date, 1) })}
            aria-label={view === "month" ? "Next month" : "Next week"}
          >
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="min-w-40 font-heading text-base font-medium">
          {periodTitle}
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link href={href(keep)}>Today</Link>
        </Button>
      </div>
      {weeks ? (
        <>
          <div className="hidden sm:block">
            <MonthCalendar
              weeks={weeks}
              month={params.date}
              today={today}
              eventsByDay={eventsByDay}
              addHref={addHref}
              dayHref={(date) => href({ ...keep, view: "week", date })}
              noun={NOUN}
            />
          </div>
          <div className="sm:hidden">
            {listDays.length > 0 ? (
              list
            ) : (
              <div className="rounded-lg border bg-card">
                <EmptyState
                  title="No jobs this month"
                  description={
                    canSchedule
                      ? "Use Schedule job to add one."
                      : "Nothing is assigned to you yet."
                  }
                />
              </div>
            )}
          </div>
        </>
      ) : (
        list
      )}
      <p className="text-sm text-muted-foreground">
        Green = done · Amber = in progress · Blue = scheduled · Grey =
        postponed.
      </p>
      {params.add && mofs && (
        <AddJobDialog
          date={params.add}
          mofs={mofs}
          team={team}
          closeHref={href(here)}
        />
      )}
    </div>
  );
}
