import { z } from "zod";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { ownSiteIds } from "../../site-work/site-work-data";

/** A job with a MOF the supervisor can log a visit to. */
export type MofChoice = {
  id: string;
  mofNo: string;
  projectName: string;
  companyName: string;
  salespersonId: string;
  /** On a job of theirs (booked or already logged) rather than another supervisor's. */
  mine: boolean;
  /** The latest installed % logged, so a lower answer can be questioned. */
  lastInstalled: { pct: number; on: CalendarDate } | null;
};

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    project_name: z.string(),
    company_name: z.string(),
    salesperson_id: z.string(),
    site_logs: z.array(
      z.object({ visited_on: z.iso.date(), inst_pct: z.number() }),
    ),
  }),
);

/** Open MOFs, the supervisor's own jobs flagged. Newest MOF first. */
export async function loadMofChoices(
  supervisorId: string,
): Promise<MofChoice[]> {
  const supabase = await createClient();
  const [{ data, error }, own] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, project_name, company_name, salesperson_id, site_logs(visited_on, inst_pct)",
      )
      .not("stage", "in", "(closed,cancelled)")
      .not("site_logs.inst_pct", "is", null)
      .order("mof_no", { ascending: false }),
    ownSiteIds(supabase, supervisorId),
  ]);
  if (error) throw new Error(`Could not load the jobs: ${error.message}`);
  return mofRows.parse(data).map((row) => {
    const latest = [...row.site_logs].sort((a, b) =>
      b.visited_on.localeCompare(a.visited_on),
    )[0];
    return {
      id: row.id,
      mofNo: row.mof_no,
      projectName: row.project_name,
      companyName: row.company_name,
      salespersonId: row.salesperson_id,
      mine: own.has(row.id),
      lastInstalled: latest
        ? { pct: latest.inst_pct, on: latest.visited_on }
        : null,
    };
  });
}

/** A project still in the sales pipeline, which a visit to a new site can point at. */
export type PipelineProject = { id: string; name: string; picId: string };

const projectRows = z.array(
  z.object({ id: z.string(), name: z.string(), pic_id: z.string() }),
);

export async function loadPipelineProjects(): Promise<PipelineProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, pic_id")
    .not("stage", "in", "(awarded,lost,on_hold)")
    .order("name");
  if (error) throw new Error(`Could not load the projects: ${error.message}`);
  return projectRows
    .parse(data)
    .map((row) => ({ id: row.id, name: row.name, picId: row.pic_id }));
}
