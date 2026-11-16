import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { MonthCalendar } from "@/components/app/month-calendar";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  canAnswerBookings,
  canBookSiteSupervisor,
  canEditInstallers,
  canScheduleJobs,
  canSetNextDoNumber,
  canUpdateJobStatus,
} from "@/lib/auth/job-role";
import { canOpen } from "@/lib/auth/page-access";
import { pageLabel } from "@/lib/auth/pages";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  formatMonthTitle,
  isSameMonth,
  monthWeeks,
  weekDays,
} from "@/lib/domain/calendar-grid";
import { formatDate, todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { createClient } from "@/lib/supabase/server";
import { parseCalendarParams, stepDate } from "../calendar/calendar-params";
import { AddJobDialog } from "./add-job-dialog";
import {
  loadBookableProjects,
  loadCalendarBookings,
  loadPendingBookingDays,
  loadSiteSupervisors,
} from "./booking-data";
import { BookingDialog } from "./booking-form";
import { calendarItems } from "./calendar-items";
import { loadCalendarJobs } from "./calendar-jobs";
import { loadNextDoNumber } from "./do-data";
import { DoNumberingDialog } from "./do-numbering-dialog";
import { InstallationFilters } from "./installation-filters";
import {
  installationHref,
  parseInstallationTab,
  parseInstallerFilter,
} from "./installation-params";
import { InstallationTabs } from "./installation-tabs";
import { InstallerContacts } from "./installer-contacts";
import { loadInstallerChoices } from "./installer-data";
import { JobList } from "./job-list";
import { loadSalespeople } from "./job-people-data";
import { loadMofOptions } from "./mof-options";
import { SupervisorBookings } from "./supervisor-bookings";
import { loadUnsignedDos } from "./unsigned-do-data";
import { UnsignedDosPanel } from "./unsigned-dos-panel";

export const metadata: Metadata = { title: "Installation" };

const NOUN = { one: "job", many: "jobs" };

export default async function InstallationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("inst");
  const t = await getT(me.language);
  const query = await searchParams;
  const title = t(pageLabel("inst", me));
  if (parseInstallationTab(query.tab) === "contacts") {
    return (
      <InstallerContacts t={t} title={title} canEdit={canEditInstallers(me)} />
    );
  }
  if (parseInstallationTab(query.tab) === "supervisors") {
    return <SupervisorBookings t={t} me={me} query={query} title={title} />;
  }
  const params = parseCalendarParams(query);
  const { view } = params;
  const installerId = parseInstallerFilter(query.installer);
  const today = todayMyt();
  const canSchedule = canScheduleJobs(me.jobRole);
  const canBook = canBookSiteSupervisor(me.jobRole);
  const answersBookings = canAnswerBookings(me.jobRole);

  const weeks = view === "month" ? monthWeeks(params.date) : null;
  const days = weeks ? weeks.flat() : weekDays(params.date);
  const from = days[0];
  const to = days[days.length - 1];

  // A Site Supervisor sees their own jobs and bookings; everyone else sees the whole schedule.
  const ownOnly = me.jobRole === "site" ? me.id : null;
  // Someone else's filter does not widen a Site Supervisor's own jobs.
  const supervisorFilter = ownOnly ?? params.who ?? null;
  const [
    jobs,
    bookings,
    team,
    mofs,
    supervisors,
    projects,
    pendingDays,
    installers,
    unsignedDos,
    salespeople,
    nextDoNo,
  ] = await Promise.all([
    loadCalendarJobs(from, to, supervisorFilter, installerId),
    // A booking has no installer, so filtering by installer leaves none.
    installerId
      ? Promise.resolve([])
      : loadCalendarBookings(from, to, supervisorFilter),
    getTeamDirectory(),
    canSchedule && params.add ? loadMofOptions() : Promise.resolve(null),
    ownOnly ? Promise.resolve([]) : loadSiteSupervisors(),
    canBook ? loadBookableProjects(me) : Promise.resolve([]),
    answersBookings ? loadPendingBookingDays(me.id) : Promise.resolve([]),
    loadInstallerChoices(installerId),
    loadUnsignedDos(supervisorFilter, installerId),
    canSchedule ? loadSalespeople() : Promise.resolve([]),
    canSetNextDoNumber(me.jobRole)
      ? createClient().then(loadNextDoNumber)
      : Promise.resolve(null),
  ]);
  const people = { installers, supervisors, salespeople };

  const keep = {
    view,
    installer: installerId,
    who: ownOnly ? undefined : params.who,
  };
  const here = { ...keep, date: params.date };
  const href = installationHref;

  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const eventsByDay = calendarItems({
    jobs,
    bookings,
    from,
    to,
    supervisorName: (id) => nameOf.get(id) ?? t("Unnamed"),
    hrefFor: (day) => href({ ...keep, view: "week", date: day }),
  });

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
      t={t}
      days={listDays}
      today={today}
      eventsByDay={eventsByDay}
      team={team}
      people={canSchedule ? people : undefined}
      meId={me.id}
      canSchedule={canSchedule}
      canCorrectDoNo={me.jobRole === "md"}
      canUpdateStatus={canUpdateJobStatus(me.jobRole)}
      canOpenMof={await canOpen(me, "mof")}
      canAnswerBookings={answersBookings}
      addHref={view === "week" ? addHref : undefined}
      emptyText={t("No jobs.")}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={title}
        description={`${jobs.length} ${t(jobs.length === 1 ? "job" : "jobs")} · ${inProgress} ${t(weeks ? "in progress this month" : "in progress this week")}${me.jobRole === "site" ? ` · ${t("yours")}` : ""}`}
        actions={
          <>
            <InstallationTabs t={t} active="installers" />
            <div className="inline-flex gap-1">
              <Button
                asChild
                size="sm"
                variant={view === "month" ? "default" : "outline"}
              >
                <Link href={href({ ...here, view: "month" })}>
                  {t("Month")}
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={view === "week" ? "default" : "outline"}
              >
                <Link href={href({ ...here, view: "week" })}>{t("Week")}</Link>
              </Button>
            </div>
            {canBook && supervisors.length > 0 && (
              <BookingDialog
                supervisors={supervisors}
                projects={projects}
                defaultDate={today}
              />
            )}
            {nextDoNo && <DoNumberingDialog nextNo={nextDoNo} />}
            {addHref && (
              <Button asChild size="sm">
                <Link href={addHref(today)}>
                  <Plus data-icon="inline-start" />
                  {t("Schedule job")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      {pendingDays[0] && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-warn-bg px-3 py-2 text-sm text-warn">
          <span className="font-medium">
            {pendingDays.length} {t("booking")}{" "}
            {pendingDays.length === 1 ? t("request") : t("requests")}{" "}
            {t("waiting for you")}
          </span>
          <Button asChild size="sm" variant="outline">
            <Link href={href({ view: "week", date: pendingDays[0] })}>
              {t("Review")}
            </Link>
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href({ ...keep, date: stepDate(view, params.date, -1) })}
            aria-label={
              view === "month" ? t("Previous month") : t("Previous week")
            }
          >
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={href({ ...keep, date: stepDate(view, params.date, 1) })}
            aria-label={view === "month" ? t("Next month") : t("Next week")}
          >
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="min-w-40 font-heading text-base font-medium">
          {periodTitle}
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link href={href(keep)}>{t("Today")}</Link>
        </Button>
        <div className="ml-auto">
          <InstallationFilters
            t={t}
            view={view}
            date={params.date}
            installers={installers}
            supervisors={ownOnly ? undefined : supervisors}
            installerId={installerId}
            supervisorId={params.who}
          />
        </div>
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
                  title={t("No jobs this month")}
                  description={
                    canSchedule
                      ? t("Use Schedule job to add one.")
                      : t("Nothing is assigned to you yet.")
                  }
                />
              </div>
            )}
          </div>
        </>
      ) : (
        list
      )}
      <UnsignedDosPanel t={t} dos={unsignedDos} today={today} />
      <p className="text-sm text-muted-foreground">
        {t(
          "Jobs: green = done · amber = in progress · blue = scheduled · grey = postponed. Site supervisor bookings: amber = waiting for an answer · green = confirmed · grey = declined.",
        )}
      </p>
      {params.add && mofs && (
        <AddJobDialog
          date={params.add}
          mofs={mofs}
          team={team}
          people={people}
          closeHref={href(here)}
        />
      )}
    </div>
  );
}
