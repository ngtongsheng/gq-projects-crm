import { z } from "zod";
import { addDays, type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

const visitRows = z.array(z.object({ starts_at: z.string() }));
const siteRows = z.array(z.object({ visited_on: z.iso.date() }));

/**
 * The days in a period the person has a visit or site work logged (demo dayItin): a sales
 * visit, meeting or walk-in that was not cancelled (calls do not count), or a site log. A claimed
 * expense on any other day is flagged for the checker (D5).
 */
export async function loadLoggedDays(
  personId: string,
  period: { from: CalendarDate; to: CalendarDate },
): Promise<Set<CalendarDate>> {
  const supabase = await createClient();
  const [visits, sites] = await Promise.all([
    supabase
      .from("activities")
      .select("starts_at")
      .eq("owner_id", personId)
      .neq("type", "call")
      .neq("status", "cancelled")
      .gte("starts_at", `${period.from}T00:00:00+08:00`)
      .lt("starts_at", `${addDays(period.to, 1)}T00:00:00+08:00`),
    supabase
      .from("site_logs")
      .select("visited_on")
      .eq("supervisor_id", personId)
      .gte("visited_on", period.from)
      .lte("visited_on", period.to),
  ]);
  if (visits.error) {
    throw new Error(`Could not load your visits: ${visits.error.message}`);
  }
  if (sites.error) {
    throw new Error(`Could not load your site logs: ${sites.error.message}`);
  }
  return new Set([
    ...visitRows
      .parse(visits.data)
      .map((row) => todayMyt(new Date(row.starts_at))),
    ...siteRows.parse(sites.data).map((row) => row.visited_on),
  ]);
}
