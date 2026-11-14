import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { isManager } from "@/lib/auth/job-role";
import { loadMyTeam } from "@/lib/auth/my-team";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { weekDays } from "@/lib/domain/calendar-grid";
import { todayMyt } from "@/lib/format/date";
import { canLogActivity } from "../activities/activity-access";
import { AddActivityDialog } from "./add-activity-dialog";
import {
  loadCalendarActivities,
  loadCustomerOptions,
  loadTodaysCalls,
} from "./calendar-data";
import { eventsByDay } from "./calendar-events";
import {
  type CalendarParams,
  calendarHref,
  parseCalendarParams,
} from "./calendar-params";
import { calendarPeriod } from "./calendar-period";
import { CalendarToolbar } from "./calendar-toolbar";
import { MonthlyList } from "./monthly-list";
import { PlanCallDialog } from "./plan-call-dialog";
import { teamFilter } from "./team-filter";
import { TodaysCalls } from "./todays-calls";
import { ViewTabs } from "./view-tabs";
import { WeekView } from "./week-view";
import { WeeklyOutcomes } from "./weekly-outcomes";
import { defaultOutcomesDate } from "./weekly-outcomes-data";

export const metadata: Metadata = { title: "Sales Calendar" };

export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("cal");
  const today = todayMyt();
  const query = await searchParams;
  const parsed = parseCalendarParams(query, today, "week");
  // The grid view belongs to installation; an old link to it opens the Monthly list.
  const view = parsed.view === "month" ? "list" : parsed.view;
  const params =
    view === "outcomes" && query.date === undefined
      ? { ...parsed, date: defaultOutcomesDate(today) }
      : parsed;
  const canAdd = canLogActivity(me.jobRole);
  const manager = isManager(me.jobRole);

  const [team, myTeamIds] = await Promise.all([
    getTeamDirectory(),
    manager ? loadMyTeam() : Promise.resolve(null),
  ]);
  // Salespeople see their own diary; managers look at one person or their whole team.
  const filter = manager
    ? teamFilter({ members: team, team: myTeamIds, picked: params.who })
    : undefined;
  const personId = filter ? filter.who : me.id;
  const showOwner = personId === undefined;

  const period = calendarPeriod(view, params.date);
  const [activities, todaysCalls, customers] = await Promise.all([
    loadCalendarActivities({
      meId: me.id,
      personId,
      from: period.from,
      to: period.to,
    }),
    canAdd ? loadTodaysCalls(me.id, today) : Promise.resolve([]),
    canAdd && (params.add || params.call)
      ? loadCustomerOptions()
      : Promise.resolve(null),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const href = (patch: Partial<CalendarParams>) =>
    calendarHref({ view, who: filter?.who, ...patch }, "/calendar", "week");
  const replyHref = (day: string) => href({ view: "week", date: day });
  const closeHref = href({ date: params.date });

  const visitsDone = activities.filter(
    (a) =>
      a.status === "completed" &&
      (a.type === "visit" || a.type === "site_visit"),
  ).length;
  const planned = activities.filter((a) => a.status === "planned").length;
  const teamLabel = filter?.allLabel === "My team" ? "my team" : "whole team";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Calendar"
        description={`${visitsDone} visits done · ${planned} planned this ${period.isMonth ? "month" : "week"}${showOwner && manager ? ` · ${teamLabel}` : ""}`}
        actions={
          <>
            <ViewTabs current={view} href={href} />
            {canAdd && (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={href({ date: params.date, call: today })}>
                    Plan a call
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={href({ date: params.date, add: today })}>
                    Add appointment
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />
      <TodaysCalls calls={todaysCalls} />
      <CalendarToolbar
        view={view}
        date={params.date}
        title={period.title}
        href={href}
        filter={filter}
      />
      {view === "week" && (
        <WeekView
          days={weekDays(params.date)}
          today={today}
          eventsByDay={eventsByDay({
            activities,
            meId: me.id,
            personId,
            nameOf,
            replyHref,
          })}
          addHref={
            canAdd
              ? (date) => href({ date: params.date, add: date })
              : undefined
          }
        />
      )}
      {view === "list" && (
        <MonthlyList
          activities={activities}
          meId={me.id}
          nameOf={nameOf}
          showOwner={showOwner}
          replyHref={replyHref}
        />
      )}
      {view === "outcomes" && (
        <WeeklyOutcomes me={me} date={params.date} picked={filter?.who} />
      )}
      <p className="text-sm text-muted-foreground">
        Green = completed · Blue = planned · Amber = outcome not logged · Grey =
        cancelled · Dashed amber = invitation waiting for your reply. "+ Eddie
        ?" means Eddie has not replied yet. Only completed visits and site
        visits count toward the 50-visit target; calls and online meetings keep
        a customer active.
      </p>
      {params.add && customers && (
        <AddActivityDialog
          date={params.add}
          customers={customers}
          colleagues={team.filter((member) => member.id !== me.id)}
          closeHref={closeHref}
        />
      )}
      {params.call && customers && (
        <PlanCallDialog
          date={params.call}
          customers={customers}
          closeHref={closeHref}
        />
      )}
    </div>
  );
}
