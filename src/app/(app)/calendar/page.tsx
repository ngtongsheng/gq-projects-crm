import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import type { CalendarEvent } from "@/components/app/calendar-event";
import { MonthCalendar } from "@/components/app/month-calendar";
import { PageHeader } from "@/components/app/page-header";
import type { StatusTone } from "@/components/app/status-badge";
import { WeekList } from "@/components/app/week-list";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  formatMonthTitle,
  monthWeeks,
  weekDays,
} from "@/lib/domain/calendar-grid";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { canLogActivity } from "../activities/activity-access";
import { toMytInput } from "../activities/activity-time";
import { activityDay } from "../activities/last-activity";
import {
  ActivityStatus,
  type ActivityStatus as ActivityStatusValue,
  ActivityType,
  ActivityTypeLabel,
} from "../activities/schemas";
import { AddActivityDialog } from "./add-activity-dialog";
import { calendarHref, parseCalendarParams, stepDate } from "./calendar-params";

export const metadata: Metadata = { title: "Sales Calendar" };

const ALL = "all";

const statusTone: Record<ActivityStatusValue, StatusTone> = {
  planned: "info",
  completed: "good",
  cancelled: "neutral",
};

const activityRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    starts_at: z.string(),
    status: ActivityStatus,
    contacts: z.object({
      name: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

const customerRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    companies: z.object({ name: z.string() }),
  }),
);

export default async function SalesCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("salesCalendar");
  const params = parseCalendarParams(await searchParams);
  const { view } = params;
  const today = todayMyt();
  const canAdd = canLogActivity(me.jobRole);
  const manager = isManager(me.jobRole);
  // Salespeople see their own diary; managers can look at anyone's or the whole team's.
  const personId = manager ? params.who : me.id;

  const weeks = view === "month" ? monthWeeks(params.date) : null;
  const days = weeks ? weeks.flat() : weekDays(params.date);
  const from = days[0];
  const to = days[days.length - 1];

  const supabase = await createClient();
  let activityQuery = supabase
    .from("activities")
    .select(
      "id, contact_id, owner_id, type, purpose, starts_at, status, contacts(name, companies(name))",
    )
    .gte("starts_at", `${from}T00:00:00+08:00`)
    .lt("starts_at", `${addDays(to, 1)}T00:00:00+08:00`)
    .order("starts_at");
  if (personId) activityQuery = activityQuery.eq("owner_id", personId);

  const [activityResult, team, customers] = await Promise.all([
    activityQuery,
    getTeamDirectory(),
    canAdd && params.add ? loadCustomerOptions() : Promise.resolve(null),
  ]);
  if (activityResult.error) {
    throw new Error(
      `Could not load activities: ${activityResult.error.message}`,
    );
  }
  const activities = activityRows.parse(activityResult.data);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const showOwner = personId === undefined;

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const activity of activities) {
    const day = activityDay(activity.starts_at);
    const clock = toMytInput(activity.starts_at).slice(11);
    const owner = nameOf.get(activity.owner_id) ?? "Unnamed";
    const event: CalendarEvent = {
      id: activity.id,
      time: showOwner ? `${clock} · ${owner}` : clock,
      title: activity.contacts.companies.name,
      detail: `${ActivityTypeLabel[activity.type]} · ${activity.purpose}`,
      tone: statusTone[activity.status],
      href: `/customers/${activity.contact_id}`,
      muted: activity.status === "cancelled",
    };
    eventsByDay.set(day, [...(eventsByDay.get(day) ?? []), event]);
  }

  const visitsDone = activities.filter(
    (a) =>
      a.status === "completed" &&
      (a.type === "visit" || a.type === "site_visit"),
  ).length;
  const planned = activities.filter((a) => a.status === "planned").length;

  const periodTitle = weeks
    ? formatMonthTitle(params.date)
    : `${formatDate(from)} – ${formatDate(to)}`;
  const keep = { view, who: params.who };
  const here = { ...keep, date: params.date };
  const addHref = canAdd
    ? (date: string) => calendarHref({ ...here, add: date })
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Sales Calendar"
        description={`${visitsDone} visits done · ${planned} planned this ${weeks ? "month" : "week"}${showOwner && manager ? " · whole team" : ""}`}
        actions={
          <div className="inline-flex gap-1">
            <Button
              asChild
              size="sm"
              variant={view === "month" ? "default" : "outline"}
            >
              <Link href={calendarHref({ ...here, view: "month" })}>Month</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={view === "week" ? "default" : "outline"}
            >
              <Link href={calendarHref({ ...here, view: "week" })}>Week</Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={calendarHref({
              ...keep,
              date: stepDate(view, params.date, -1),
            })}
            aria-label={view === "month" ? "Previous month" : "Previous week"}
          >
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild size="icon-sm" variant="outline">
          <Link
            href={calendarHref({
              ...keep,
              date: stepDate(view, params.date, 1),
            })}
            aria-label={view === "month" ? "Next month" : "Next week"}
          >
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="min-w-40 font-heading text-base font-medium">
          {periodTitle}
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link href={calendarHref(keep)}>Today</Link>
        </Button>
        {manager && (
          <form action="/calendar" className="ml-auto flex items-center gap-2">
            {view === "week" && (
              <input type="hidden" name="view" value="week" />
            )}
            <input type="hidden" name="date" value={params.date} />
            <Select name="who" defaultValue={params.who ?? ALL}>
              <SelectTrigger aria-label="Salesperson" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Everyone</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline">
              Show
            </Button>
          </form>
        )}
      </div>
      {weeks ? (
        <MonthCalendar
          weeks={weeks}
          month={params.date}
          today={today}
          eventsByDay={eventsByDay}
          addHref={addHref}
          dayHref={(date) => calendarHref({ ...keep, view: "week", date })}
        />
      ) : (
        <WeekList
          days={days}
          today={today}
          eventsByDay={eventsByDay}
          addHref={addHref}
        />
      )}
      <p className="text-sm text-muted-foreground">
        Green = completed · Blue = planned · Grey = cancelled. Only completed
        visits and site visits count toward the 50-visit target; calls and
        online meetings keep a customer active.
      </p>
      {params.add && customers && (
        <AddActivityDialog
          date={params.add}
          customers={customers}
          closeHref={calendarHref(here)}
        />
      )}
    </div>
  );
}

async function loadCustomerOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, name, companies(name)")
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error(`Could not load customers: ${error.message}`);
  return customerRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.name} · ${row.companies.name}`,
  }));
}
