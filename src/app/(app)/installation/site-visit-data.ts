import { z } from "zod";
import { SITE_ACTIVITIES, type SiteActivity } from "@/lib/domain/site-log";
import { createClient } from "@/lib/supabase/server";

/** A visit a Site Supervisor logged on a project, as the calendar shows it. */
export type CalendarSiteVisit = {
  id: string;
  supervisorId: string;
  visitedOn: string;
  activity: SiteActivity;
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
};

const visitRows = z.array(
  z.object({
    id: z.string(),
    supervisor_id: z.string(),
    visited_on: z.string(),
    activity: z.enum(SITE_ACTIVITIES),
    mof_id: z.string(),
    mofs: z.object({
      mof_no: z.string(),
      company_name: z.string(),
      project_name: z.string(),
    }),
  }),
);

/** Visits logged on any day from `from` to `to`; `supervisorId` limits them to one person's own. */
export async function loadCalendarSiteVisits(
  from: string,
  to: string,
  supervisorId: string | null,
): Promise<CalendarSiteVisit[]> {
  const supabase = await createClient();
  let query = supabase
    .from("site_logs")
    .select(
      "id, supervisor_id, visited_on, activity, mof_id, mofs(mof_no, company_name, project_name)",
    )
    .gte("visited_on", from)
    .lte("visited_on", to)
    .order("visited_on");
  if (supervisorId) query = query.eq("supervisor_id", supervisorId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load site visits: ${error.message}`);
  return visitRows.parse(data).map((row) => ({
    id: row.id,
    supervisorId: row.supervisor_id,
    visitedOn: row.visited_on,
    activity: row.activity,
    mofId: row.mof_id,
    mofNo: row.mofs.mof_no,
    companyName: row.mofs.company_name,
    projectName: row.mofs.project_name,
  }));
}
