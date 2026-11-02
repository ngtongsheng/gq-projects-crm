import { z } from "zod";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import type { createClient } from "@/lib/supabase/server";

/** The Malaysia calendar day an activity's timestamp falls on. */
export const activityDay = (startsAt: string): CalendarDate =>
  todayMyt(new Date(startsAt));

/** Day of the latest completed activity in `rows`, or null when none is completed. */
export function lastCompletedDay(
  rows: { status: string; startsAt: string }[],
): CalendarDate | null {
  const days = rows
    .filter((row) => row.status === "completed")
    .map((row) => activityDay(row.startsAt))
    .sort();
  return days.at(-1) ?? null;
}

const lastActivityRows = z.array(
  z.object({ contact_id: z.string(), last_completed_at: z.string() }),
);

/** Latest completed activity day per customer, in one query. Customers with none are absent. */
export async function getLastCompletedDays(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, CalendarDate>> {
  const { data, error } = await supabase
    .from("customer_last_activity")
    .select("contact_id, last_completed_at");
  if (error) throw new Error(`Could not load activity dates: ${error.message}`);
  return new Map(
    lastActivityRows
      .parse(data)
      .map((row) => [row.contact_id, activityDay(row.last_completed_at)]),
  );
}
