import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/auth/current-profile";
import {
  canAnswerBookings,
  canBookSiteSupervisor,
  canScheduleJobs,
  canUpdateJobStatus,
} from "@/lib/auth/job-role";
import { canOpen } from "@/lib/auth/page-access";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { weekDays } from "@/lib/domain/calendar-grid";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import { parseCalendarParams, stepDate } from "../calendar/calendar-params";
import { SegmentLinks } from "../site-work/segment-links";
import {
  loadBookableProjects,
  loadCalendarBookings,
  loadSiteSupervisors,
} from "./booking-data";
import { BookingDialog } from "./booking-form";
import { calendarItems } from "./calendar-items";
import { loadCalendarJobs } from "./calendar-jobs";
import { installationHref } from "./installation-params";
import { InstallationTabs } from "./installation-tabs";
import { loadInstallerChoices } from "./installer-data";
import { JobList } from "./job-list";
import { loadSalespeople } from "./job-people-data";
import { SupervisorBookingTable } from "./supervisor-booking-table";

const WHO_ALL = "all";

type SupervisorBookingsProps = {
  me: Profile;
  query: Record<string, string | string[] | undefined>;
  title: string;
};

/**
 * The Site supervisors view (demo: supSchedule): the week of each supervisor's jobs and
 * bookings, and the bookings coming up with their status and reply. A Site Supervisor sees
 * and answers their own.
 */
export async function SupervisorBookings({
  me,
  query,
  title,
}: SupervisorBookingsProps) {
  const params = parseCalendarParams(query, todayMyt(), "week");
  const today = todayMyt();
  const canSchedule = canScheduleJobs(me.jobRole);
  const canBook = canBookSiteSupervisor(me.jobRole);
  const ownOnly = me.jobRole === "site" ? me.id : null;
  const supervisorFilter = ownOnly ?? params.who ?? null;

  const days = weekDays(params.date);
  const from = days[0];
  const to = days[days.length - 1];

  const [
    jobs,
    weekBookings,
    comingUp,
    team,
    supervisors,
    projects,
    installers,
    salespeople,
    canOpenMof,
  ] = await Promise.all([
    loadCalendarJobs(from, to, supervisorFilter),
    loadCalendarBookings(from, to, supervisorFilter),
    loadCalendarBookings(today, addDays(today, 365), supervisorFilter),
    getTeamDirectory(),
    loadSiteSupervisors(),
    canBook ? loadBookableProjects(me) : Promise.resolve([]),
    canSchedule ? loadInstallerChoices() : Promise.resolve([]),
    canSchedule ? loadSalespeople() : Promise.resolve([]),
    canOpen(me, "mof"),
  ]);

  const keep = {
    who: ownOnly ? undefined : params.who,
    tab: "supervisors",
  } as const;
  const href = (date: string) => installationHref({ ...keep, date });
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  // A declined booking frees the supervisor's time, so it leaves the week; the table keeps it.
  const eventsByDay = calendarItems({
    jobs: jobs.filter((job) => job.siteSupervisorId !== ""),
    bookings: weekBookings.filter((booking) => booking.status !== "declined"),
    from,
    to,
    supervisorName: (id) => nameOf.get(id) ?? "Unnamed",
    hrefFor: href,
  });
  const waiting = comingUp.filter((booking) => booking.status === "requested");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={`${comingUp.length} ${comingUp.length === 1 ? "booking" : "bookings"} coming up · ${waiting.length} waiting for an answer${ownOnly ? " · yours" : ""}`}
        actions={
          <>
            <InstallationTabs active="supervisors" />
            {canBook && supervisors.length > 0 && (
              <BookingDialog
                supervisors={supervisors}
                projects={projects}
                defaultDate={today}
              />
            )}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href(stepDate("week", params.date, -1))}
            aria-label="Previous week"
          >
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href(stepDate("week", params.date, 1))}
            aria-label="Next week"
          >
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="min-w-40 font-heading text-base font-medium">
          {formatDate(from)} – {formatDate(to)}
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link href={installationHref(keep)}>This week</Link>
        </Button>
        {!ownOnly && supervisors.length > 0 && (
          <div className="ml-auto">
            <SegmentLinks
              label="Site supervisor"
              active={params.who ?? WHO_ALL}
              items={[
                {
                  key: WHO_ALL,
                  label: "Everyone",
                  href: installationHref({
                    date: params.date,
                    tab: "supervisors",
                  }),
                },
                ...supervisors.map((supervisor) => ({
                  key: supervisor.id,
                  label: supervisor.name,
                  href: installationHref({
                    date: params.date,
                    who: supervisor.id,
                    tab: "supervisors",
                  }),
                })),
              ]}
            />
          </div>
        )}
      </div>
      <JobList
        days={days}
        today={today}
        eventsByDay={eventsByDay}
        team={team}
        people={
          canSchedule ? { installers, supervisors, salespeople } : undefined
        }
        meId={me.id}
        canSchedule={canSchedule}
        canUpdateStatus={canUpdateJobStatus(me.jobRole)}
        canOpenMof={canOpenMof}
        canAnswerBookings={false}
        emptyText="No supervisor jobs or bookings."
      />
      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium">
          Site supervisor bookings
        </h2>
        {comingUp.length > 0 ? (
          <SupervisorBookingTable
            bookings={comingUp}
            nameOf={Object.fromEntries(nameOf)}
            meId={me.id}
            canAnswer={canAnswerBookings(me.jobRole)}
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <EmptyState
              title="No bookings coming up"
              description={
                canBook
                  ? "Use Book a site supervisor to ask for a visit."
                  : "Nothing is booked yet."
              }
            />
          </div>
        )}
      </section>
      <p className="text-sm text-muted-foreground">
        Bookings: amber = waiting for an answer · green = confirmed · grey =
        declined (shown in the list only). The supervisor answers; a decline
        carries a reply.
      </p>
    </div>
  );
}
