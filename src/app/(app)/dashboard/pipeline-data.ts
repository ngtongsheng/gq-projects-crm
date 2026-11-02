import { z } from "zod";
import { projectFlags } from "@/lib/domain/project-flags";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { OPEN_STAGES, ProjectStage } from "../projects/schemas";

export type OpenProject = {
  id: string;
  name: string;
  companyName: string;
  stage: ProjectStage;
  value: number;
  picId: string;
  supportId: string | null;
  nextActionDate: string | null;
  overdue: boolean;
  stale: boolean;
};

const rows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    stage: ProjectStage,
    value: z.number(),
    pic_id: z.string(),
    support_id: z.string().nullable(),
    next_action_date: z.string().nullable(),
    updated_at: z.string(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

/** Every project still being chased, with the overdue and stale flags the Projects screen uses. */
export async function loadOpenProjects(
  today: CalendarDate,
): Promise<OpenProject[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, stage, value, pic_id, support_id, next_action_date, updated_at, contacts(companies(name))",
    )
    .in("stage", OPEN_STAGES);
  if (error) throw new Error(`Could not load projects: ${error.message}`);

  return rows.parse(data).map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.contacts.companies.name,
    stage: row.stage,
    value: row.value,
    picId: row.pic_id,
    supportId: row.support_id,
    nextActionDate: row.next_action_date,
    ...projectFlags(
      {
        open: true,
        nextActionDate: row.next_action_date,
        updatedAt: row.updated_at,
      },
      today,
    ),
  }));
}

/** A person's own projects: the ones they lead or support. */
export const projectsOf = (
  projects: readonly OpenProject[],
  personId: string,
): OpenProject[] =>
  projects.filter(
    (project) => project.picId === personId || project.supportId === personId,
  );

/** Overdue or stale projects, overdue first. */
export const projectsToChase = (
  projects: readonly OpenProject[],
): OpenProject[] =>
  projects
    .filter((project) => project.overdue || project.stale)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));
