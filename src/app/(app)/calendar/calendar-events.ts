import type { CalendarEvent } from "@/components/app/calendar-event";
import type { CalendarDate } from "@/lib/format/date";
import { activityStatusTone } from "../activities/activity-status-tone";
import { toMytInput } from "../activities/activity-time";
import { activityDay } from "../activities/last-activity";
import { needsOutcome } from "../activities/outcome-schema";
import { ActivityTypeLabel } from "../activities/schemas";
import type { CalendarActivity } from "./calendar-data";
import { invitationTag, isAwaitingReply } from "./invitation-view";

/** The week view's cards, grouped by the Malaysia day each activity falls on. */
export function eventsByDay(input: {
  activities: readonly CalendarActivity[];
  meId: string;
  /** Whose diary this is; undefined when showing a whole team. */
  personId: string | undefined;
  nameOf: ReadonlyMap<string, string>;
  /** Where an invitation waiting for a reply is answered. */
  replyHref: (day: CalendarDate) => string;
}): Map<CalendarDate, CalendarEvent[]> {
  const { activities, meId, personId, nameOf, replyHref } = input;
  const byDay = new Map<CalendarDate, CalendarEvent[]>();
  for (const activity of activities) {
    const day = activityDay(activity.starts_at);
    const clock = toMytInput(activity.starts_at).slice(11);
    const owner = nameOf.get(activity.owner_id) ?? "Unnamed";
    const awaitingReply = isAwaitingReply(
      activity.owner_id,
      activity.activity_invitees,
      meId,
    );
    const tag = awaitingReply
      ? undefined
      : invitationTag({
          ownerName: owner,
          ownerIsMe: activity.owner_id === meId,
          invitees: activity.activity_invitees.map((invitee) => ({
            profileId: invitee.profile_id,
            name: nameOf.get(invitee.profile_id) ?? "Unnamed",
            status: invitee.status,
          })),
          meId,
        });
    const byOwner = personId === undefined || activity.owner_id !== personId;
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
      href: awaitingReply
        ? replyHref(day)
        : `/customers/${activity.contact_id}`,
      muted: activity.status === "cancelled",
      awaitingReply,
      tag,
    };
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  return byDay;
}
