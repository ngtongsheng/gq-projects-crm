import Link from "next/link";
import { z } from "zod";
import { StatusBadge } from "@/components/app/status-badge";
import { addDays, type CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { activityStatusTone } from "../activities/activity-status-tone";
import { toMytInput } from "../activities/activity-time";
import {
  ActivityStatus,
  ActivityStatusLabel,
  ActivityType,
  ActivityTypeLabel,
} from "../activities/schemas";
import { Panel, PanelEmpty } from "./dashboard-parts";

const activityRows = z.array(
  z.object({
    id: z.string(),
    contact_id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    starts_at: z.string(),
    status: ActivityStatus,
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

/** Today's appointments that are not cancelled, for one person or (no `personId`) the whole team. */
async function loadTodaysActivities(today: CalendarDate, personId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(
      "id, contact_id, owner_id, type, purpose, starts_at, status, contacts(companies(name))",
    )
    .gte("starts_at", `${today}T00:00:00+08:00`)
    .lt("starts_at", `${addDays(today, 1)}T00:00:00+08:00`)
    .neq("status", "cancelled")
    .order("starts_at");
  if (personId) query = query.eq("owner_id", personId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load today's visits: ${error.message}`);
  return activityRows.parse(data);
}

/** Today's diary. With `nameOf` each line also says whose appointment it is. */
export async function TodaysActivities({
  title,
  today,
  personId,
  nameOf,
}: {
  title: string;
  today: CalendarDate;
  personId?: string;
  nameOf?: ReadonlyMap<string, string>;
}) {
  const activities = await loadTodaysActivities(today, personId);
  return (
    <Panel
      title={title}
      aside={`${activities.length} ${activities.length === 1 ? "appointment" : "appointments"}`}
    >
      {activities.length === 0 ? (
        <PanelEmpty>Nothing in the diary for today.</PanelEmpty>
      ) : (
        <ul className="divide-y">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="font-mono tabular-nums text-muted-foreground">
                {toMytInput(activity.starts_at).slice(11)}
              </span>
              <Link
                href={`/customers/${activity.contact_id}`}
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="truncate font-medium">
                  {activity.contacts.companies.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {nameOf
                    ? `${nameOf.get(activity.owner_id) ?? "Unnamed"} · `
                    : ""}
                  {ActivityTypeLabel[activity.type]} · {activity.purpose}
                </p>
              </Link>
              <StatusBadge tone={activityStatusTone[activity.status]}>
                {ActivityStatusLabel[activity.status]}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
