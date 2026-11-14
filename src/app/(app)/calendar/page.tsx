import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import {
  type CalendarEvent,
  CalendarEventLink,
} from "@/components/app/calendar-event";
import { MonthCalendar } from "@/components/app/month-calendar";
import { PageHeader } from "@/components/app/page-header";
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
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  formatMonthTitle,
  monthWeeks,
  weekDays,
} from "@/lib/domain/calendar-grid";
import { addDays, formatDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { canLogActivity } from "../activities/activity-access";
import { activityStatusTone } from "../activities/activity-status-tone";
import { toMytInput } from "../activities/activity-time";
import { activityDay } from "../activities/last-activity";
import { needsOutcome } from "../activities/outcome-schema";
import {
  ActivityStatus,
  ActivityType,
  ActivityTypeLabel,
} from "../activities/schemas";
import { AddActivityDialog } from "./add-activity-dialog";
import { calendarHref, parseCalendarParams, stepDate } from "./calendar-params";
import { InvitationCard } from "./invitation-card";
import {
  InviteeStatus,
  invitationTag,
  isAwaitingReply,
} from "./invitation-view";

export const metadata: Metadata = { title: "Sales Calendar" };

const ALL = "all";

const activityRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    starts_at: z.string(),
    status: ActivityStatus,
    activity_invitees: z.array(
      z.object({ profile_id: z.string(), status: InviteeStatus }),
    ),
    contacts: z.object({
      name: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

const invitedRows = z.array(z.object({ activity_id: z.string() }));

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
  const me = await requirePage("cal");
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
  const windowStart = `${from}T00:00:00+08:00`;
  const windowEnd = `${addDays(to, 1)}T00:00:00+08:00`;
  let activityQuery = supabase
    .from("activities")
    .select(
      "id, contact_id, owner_id, type, purpose, starts_at, status, activity_invitees(profile_id, status), contacts(name, companies(name))",
    )
    .gte("starts_at", windowStart)
    .lt("starts_at", windowEnd)
    .order("starts_at");
  if (personId) {
    // Someone's diary holds what they own plus what they have accepted; their own diary
    // also holds the invitations still waiting for a reply.
    const invitedTo = await loadInvitedActivityIds(
      personId,
      personId === me.id ? ["pending", "accepted"] : ["accepted"],
      windowStart,
      windowEnd,
    );
    activityQuery = activityQuery.or(
      invitedTo.length > 0
        ? `owner_id.eq.${personId},id.in.(${invitedTo.join(",")})`
        : `owner_id.eq.${personId}`,
    );
  }

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
  const keep = { view, who: params.who };

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const activity of activities) {
    const day = activityDay(activity.starts_at);
    const clock = toMytInput(activity.starts_at).slice(11);
    const owner = nameOf.get(activity.owner_id) ?? "Unnamed";
    const awaitingReply = isAwaitingReply(
      activity.owner_id,
      activity.activity_invitees,
      me.id,
    );
    const tag = awaitingReply
      ? undefined
      : invitationTag({
          ownerName: owner,
          ownerIsMe: activity.owner_id === me.id,
          invitees: activity.activity_invitees.map((invitee) => ({
            profileId: invitee.profile_id,
            name: nameOf.get(invitee.profile_id) ?? "Unnamed",
            status: invitee.status,
          })),
          meId: me.id,
        });
    const byOwner = showOwner || activity.owner_id !== personId;
    // A planned visit whose time has passed waits for its outcome on the customer page.
    const due = needsOutcome({
      status: activity.status,
      startsAt: activity.starts_at,
    });
    const detail = `${ActivityTypeLabel[activity.type]} · ${activity.purpose}`;
    const event: CalendarEvent = {
      id: activity.id,
      time: byOwner ? `${clock} · ${owner}` : clock,
      title: activity.contacts.companies.name,
      detail: awaitingReply
        ? `Invitation · reply · ${detail}`
        : due
          ? `Log outcome · ${detail}`
          : detail,
      tone: awaitingReply || due ? "warn" : activityStatusTone[activity.status],
      // A reply is given in the week view, so a month cell opens that week.
      href: awaitingReply
        ? calendarHref({ ...keep, view: "week", date: day })
        : `/customers/${activity.contact_id}`,
      muted: activity.status === "cancelled",
      awaitingReply,
      tag,
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
          renderEvent={(event) =>
            event.awaitingReply ? (
              <InvitationCard event={event} />
            ) : (
              <CalendarEventLink event={event} />
            )
          }
        />
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

/** Activities in the window that `profileId` is invited to with one of these answers. */
async function loadInvitedActivityIds(
  profileId: string,
  statuses: string[],
  windowStart: string,
  windowEnd: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_invitees")
    .select("activity_id, activities!inner(starts_at)")
    .eq("profile_id", profileId)
    .in("status", statuses)
    .gte("activities.starts_at", windowStart)
    .lt("activities.starts_at", windowEnd);
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return invitedRows.parse(data).map((row) => row.activity_id);
}
