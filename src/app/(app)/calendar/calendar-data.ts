import { z } from "zod";
import { formatMobile } from "@/lib/domain/mobile";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { ActivityStatus, ActivityType } from "../activities/schemas";
import { mytWindow } from "./calendar-period";
import { InviteeStatus } from "./invitation-view";

const activityRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    outcome: z.string().nullable(),
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
export type CalendarActivity = z.infer<typeof activityRows>[number];

const invitedRows = z.array(z.object({ activity_id: z.string() }));

const customerRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    companies: z.object({ name: z.string() }),
  }),
);

const callRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    starts_at: z.string(),
    contacts: z.object({
      name: z.string(),
      mobile: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

export type PlannedCall = {
  id: string;
  contactId: string;
  startsAt: string;
  customer: string;
  company: string;
  mobile: string;
};

/**
 * Activities from `from` to `to`. With `personId`, that person's diary: what they own plus what
 * they accepted; their own diary also holds the invitations still waiting for a reply. Without
 * it, everything the database lets the viewer see.
 */
export async function loadCalendarActivities(input: {
  meId: string;
  personId: string | undefined;
  from: CalendarDate;
  to: CalendarDate;
}): Promise<CalendarActivity[]> {
  const { meId, personId, from, to } = input;
  const window = mytWindow(from, to);
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(
      "id, contact_id, owner_id, type, purpose, outcome, starts_at, status, activity_invitees(profile_id, status), contacts(name, companies(name))",
    )
    .gte("starts_at", window.start)
    .lt("starts_at", window.end)
    .order("starts_at");
  if (personId) {
    const invitedTo = await loadInvitedActivityIds(
      personId,
      personId === meId ? ["pending", "accepted"] : ["accepted"],
      window,
    );
    query = query.or(
      invitedTo.length > 0
        ? `owner_id.eq.${personId},id.in.(${invitedTo.join(",")})`
        : `owner_id.eq.${personId}`,
    );
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load activities: ${error.message}`);
  return activityRows.parse(data);
}

/** Calls the person still has to make today, earliest first. */
export async function loadTodaysCalls(
  meId: string,
  today: CalendarDate,
): Promise<PlannedCall[]> {
  const window = mytWindow(today, today);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, contact_id, starts_at, contacts(name, mobile, companies(name))",
    )
    .eq("owner_id", meId)
    .eq("type", "call")
    .eq("status", "planned")
    .gte("starts_at", window.start)
    .lt("starts_at", window.end)
    .order("starts_at");
  if (error) throw new Error(`Could not load today's calls: ${error.message}`);
  return callRows.parse(data).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    startsAt: row.starts_at,
    customer: row.contacts.name,
    company: row.contacts.companies.name,
    mobile: formatMobile(row.contacts.mobile),
  }));
}

/** Customers a new activity can be logged against. */
export async function loadCustomerOptions() {
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
  window: { start: string; end: string },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_invitees")
    .select("activity_id, activities!inner(starts_at)")
    .eq("profile_id", profileId)
    .in("status", statuses)
    .gte("activities.starts_at", window.start)
    .lt("activities.starts_at", window.end);
  if (error) throw new Error(`Could not load invitations: ${error.message}`);
  return invitedRows.parse(data).map((row) => row.activity_id);
}
