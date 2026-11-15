import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import { LineUnit } from "../../mofs/schemas";

/** The most MOFs offered in the "Fill from MOF" list, newest first (demo: 80). */
const CHOICE_LIMIT = 80;

const choiceRows = z.array(
  z.object({ id: z.uuid(), mof_no: z.string(), project_name: z.string() }),
);

export type MofChoice = { id: string; label: string };

/** Awarded MOFs a form can be filled from: everything except cancelled and closed orders. */
export async function loadMofChoices(): Promise<MofChoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select("id, mof_no, project_name")
    .not("stage", "in", "(cancelled,closed)")
    .order("mof_no", { ascending: false })
    .limit(CHOICE_LIMIT);
  if (error) throw new Error(`Could not load the MOFs: ${error.message}`);
  return choiceRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.mof_no} · ${row.project_name}`,
  }));
}

const mofRow = z.object({
  mof_no: z.string(),
  company_name: z.string(),
  project_name: z.string(),
  site_address: z.string().nullable(),
  site_contact_name: z.string().nullable(),
  customer_contact: z.string().nullable(),
  salesperson_id: z.uuid(),
  mof_lines: z.array(
    z.object({
      product: z.string(),
      qty: z.number(),
      unit: LineUnit,
      area_m2: z.number(),
    }),
  ),
  jobs: z.array(
    z.object({
      scheduled_on: z.string(),
      site_supervisor_id: z.uuid().nullable(),
    }),
  ),
  site_logs: z.array(
    z.object({ visited_on: z.string(), supervisor_id: z.uuid() }),
  ),
});

export type FormMof = {
  mofNo: string;
  companyName: string;
  projectName: string;
  siteAddress: string;
  clientContact: string;
  salesperson: string;
  siteSupervisor: string;
  lines: { product: string; qty: number; unit: LineUnit; areaM2: number }[];
};

/** The latest job's supervisor, else the latest site visit's; a Site Supervisor printing it is the supervisor. */
function pickSupervisorId(
  row: z.infer<typeof mofRow>,
  viewer: Profile,
): string | null {
  if (viewer.jobRole === "site") return viewer.id;
  const byJob = row.jobs
    .filter((job) => job.site_supervisor_id !== null)
    .sort((a, b) => b.scheduled_on.localeCompare(a.scheduled_on))[0];
  if (byJob?.site_supervisor_id) return byJob.site_supervisor_id;
  const byVisit = row.site_logs.sort((a, b) =>
    b.visited_on.localeCompare(a.visited_on),
  )[0];
  return byVisit?.supervisor_id ?? null;
}

/** One MOF's details for a form, or null when the id is not a MOF the viewer can read. */
export async function loadFormMof(
  id: string,
  viewer: Profile,
): Promise<FormMof | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select(
      "mof_no, company_name, project_name, site_address, site_contact_name, customer_contact, salesperson_id, mof_lines(product, qty, unit, area_m2), jobs(scheduled_on, site_supervisor_id), site_logs(visited_on, supervisor_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the MOF: ${error.message}`);
  if (!data) return null;
  const row = mofRow.parse(data);
  const team = await getTeamDirectory();
  const nameOf = (personId: string | null) =>
    team.find((member) => member.id === personId)?.name ?? "";
  return {
    mofNo: row.mof_no,
    companyName: row.company_name,
    projectName: row.project_name,
    siteAddress: row.site_address ?? "",
    clientContact: row.site_contact_name ?? row.customer_contact ?? "",
    salesperson: nameOf(row.salesperson_id),
    siteSupervisor: nameOf(pickSupervisorId(row, viewer)),
    lines: row.mof_lines.map((line) => ({
      product: line.product,
      qty: line.qty,
      unit: line.unit,
      areaM2: line.area_m2,
    })),
  };
}
