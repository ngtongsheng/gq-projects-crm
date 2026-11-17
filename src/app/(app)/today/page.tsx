import type { Metadata } from "next";
import { z } from "zod";
import { LanguageToggle } from "@/components/app/language-toggle";
import { PageHeader } from "@/components/app/page-header";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { isSameMonth, startOfMonth } from "@/lib/domain/calendar-grid";
import { isSnoozed } from "@/lib/domain/follow-up-snooze";
import { LEAVE_TYPE_LABEL } from "@/lib/domain/leave-labels";
import {
  canChaseFollowUp,
  countSiteVisits,
  type LoggedSiteJob,
  missedLogDays,
  plannedJobsNotRecorded,
} from "@/lib/domain/site-log";
import {
  isPlannedWorkRecorded,
  plannedWork,
  shouldRemindToLog,
} from "@/lib/domain/site-plan";
import { pace as monthPace, weekKindFor } from "@/lib/domain/workdays";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import { resolveLanguage } from "@/lib/i18n/current-language";
import { getT } from "@/lib/i18n/server-t";
import { loadWorkCalendar } from "@/lib/work-calendar";
import { ReminderPanel } from "../dashboard/reminder-panel";
import { loadCalendarJobs } from "../installation/calendar-jobs";
import {
  loadLeavePeople,
  loadLeaveRows,
  loadLeaveSetup,
} from "../leave/leave-data";
import { approverLine, balanceFor } from "../leave/leave-view";
import { loadReportSettings } from "../reports/report-data";
import { AdditionalWorkAlerts } from "../site-work/additional-work";
import { loadOpenAdditionalWork } from "../site-work/additional-work-data";
import { AwayChooser } from "./away-chooser";
import {
  AwayDayBanners,
  EndOfDayBanner,
  FollowUpBanner,
  MissedDaysBanner,
  PlannedNotRecordedBanner,
} from "./log-work-banners";
import {
  AlreadyRecorded,
  DayPicker,
  MonthCounter,
  PlannedJobs,
  RecordSiteButton,
} from "./log-work-parts";
import { loadOpenFollowUps } from "./open-follow-ups";
import { loadMyBookings, loadMyLogs, loadMySiteOff } from "./today-data";

export const metadata: Metadata = { title: "Log work" };

const REMINDER_LOOKBACK_DAYS = 7;
const dayParam = z.iso.date();

const hourInMalaysia = (now: Date) =>
  Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );

/** A Site Supervisor's landing page: this month's visits, today's planned jobs and what is already logged. */
export default async function LogWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("today");
  const t = await getT(me.language);
  const today = todayMyt();
  const asked = dayParam.safeParse((await searchParams).date);
  const day = asked.success && asked.data <= today ? asked.data : today;

  const weekAgo = addDays(today, -REMINDER_LOOKBACK_DAYS);
  const planFrom = day < weekAgo ? day : weekAgo;
  const logsFrom = startOfMonth(day) < planFrom ? startOfMonth(day) : planFrom;
  const year = Number(today.slice(0, 4));

  const team = await getTeamDirectory();
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? t("Unnamed");

  const [
    logs,
    siteOff,
    jobs,
    bookings,
    calendar,
    settings,
    leaveRows,
    leaveSetup,
    people,
    followUps,
    extraWork,
  ] = await Promise.all([
    loadMyLogs(me.id, logsFrom, today),
    loadMySiteOff(me.id, planFrom, today),
    loadCalendarJobs(planFrom, today, me.id),
    loadMyBookings(me.id, planFrom, today),
    loadWorkCalendar(weekKindFor(me.jobRole)),
    loadReportSettings(),
    loadLeaveRows(),
    loadLeaveSetup(),
    loadLeavePeople(nameOf),
    loadOpenFollowUps(),
    loadOpenAdditionalWork(me.id),
  ]);

  const mine = people.find((person) => person.id === me.id) ?? {
    id: me.id,
    joinedOn: null,
    reportsTo: null,
  };
  const myLeave = leaveRows.filter((row) => row.personId === me.id);
  const approvedLeave = myLeave.filter((row) => row.status === "approved");
  // An approved leave or MC day, and an office or other day, are days away (loop 17 D2).
  const away = [...siteOff, ...approvedLeave].map((entry) => ({
    startsOn: entry.startsOn,
    endsOn: entry.endsOn,
  }));
  const covers = (entry: { startsOn: string; endsOn: string }) =>
    entry.startsOn <= day && day <= entry.endsOn;

  const balance = balanceFor(myLeave, mine, year, leaveSetup);
  const approvers = approverLine(
    { jobRole: me.jobRole, teamLeadId: mine.reportsTo },
    nameOf,
    t,
  );
  const leave = {
    today,
    week: calendar.week,
    holidays: [...calendar.holidays],
    approvers,
    available: balance && {
      ...balance,
      annualBalance: balance.annualBalance - balance.annualPending,
      mcBalance: balance.mcBalance - balance.mcPending,
    },
    availableYear: year,
  };

  const siteDays = {
    today,
    holidays: calendar.holidays,
    away,
    joinedOn: mine.joinedOn,
  };
  const loggedSites: LoggedSiteJob[] = logs;
  const planned = plannedWork({ from: planFrom, to: today, jobs, bookings });
  const dayLogs = logs.filter((log) => log.visitedOn === day);
  const dayJobs = planned
    .filter((work) => work.day === day)
    .map((work) => ({ work, recorded: isPlannedWorkRecorded(work, dayLogs) }));

  const missedDays = missedLogDays({
    ...siteDays,
    loggedDays: logs.map((log) => log.visitedOn),
  });
  const plannedMissed = plannedJobsNotRecorded({
    ...siteDays,
    planned,
    logs: loggedSites,
  });
  // Still-waiting follow-ups stay out of sight until their snooze day.
  const chased = followUps.filter(
    (followUp) =>
      canChaseFollowUp(me, followUp) && !isSnoozed(followUp.wait, today),
  );
  const remind =
    day === today &&
    shouldRemindToLog({
      today,
      hourMyt: hourInMalaysia(new Date()),
      holidays: calendar.holidays,
      away,
      loggedToday: dayLogs.length > 0,
    });
  const onLeave = approvedLeave.find(covers);

  const monthLogs = logs.filter((log) => isSameMonth(log.visitedOn, day));
  const currentMonth = isSameMonth(day, today);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-20 md:pb-0">
      <PageHeader
        title={t("Log today's work")}
        description={`${me.fullName ?? ""} · ${formatDate(day)}`}
        actions={
          <LanguageToggle
            language={await resolveLanguage(me.language)}
            languages={["en", "bm"]}
          />
        }
      />
      <AdditionalWorkAlerts
        alerts={extraWork.map((alert) => ({
          ...alert,
          by: alert.createdBy ? nameOf(alert.createdBy) : "–",
        }))}
      />
      <ReminderPanel me={me} />
      <FollowUpBanner followUps={chased} today={today} t={t} />
      <PlannedNotRecordedBanner jobs={plannedMissed} t={t} />
      <MissedDaysBanner days={missedDays} leave={leave} t={t} />
      {remind && <EndOfDayBanner t={t} />}
      <DayPicker day={day} today={today} t={t} />
      <AwayDayBanners
        day={day}
        off={siteOff.filter(covers)}
        leaveLabel={onLeave ? t(LEAVE_TYPE_LABEL[onLeave.leaveType]) : null}
        t={t}
      />
      <MonthCounter
        visits={countSiteVisits(monthLogs, day)}
        target={settings.targets.siteVisits}
        pace={currentMonth ? monthPace(today, calendar) : 1}
        stockReturns={
          monthLogs.filter((log) => log.activity === "stock_return").length
        }
        t={t}
      />
      <RecordSiteButton day={day} t={t} />
      <AwayChooser day={day} leave={leave} />
      <PlannedJobs day={day} jobs={dayJobs} t={t} />
      <AlreadyRecorded logs={dayLogs} t={t} />
    </div>
  );
}
