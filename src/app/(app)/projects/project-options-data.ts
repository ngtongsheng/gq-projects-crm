import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProjectOption = { id: string; label: string };

const projectRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

/**
 * Every project not lost, by name, for a project picker. `ownerId` limits the list to the
 * projects that person leads or supports; null lists them all.
 */
export async function loadProjectOptions(
  ownerId: string | null,
): Promise<ProjectOption[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, contacts(companies(name))")
    .neq("stage", "lost")
    .order("name");
  if (ownerId !== null) {
    query = query.or(`pic_id.eq.${ownerId},support_id.eq.${ownerId}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return projectRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.name} · ${row.contacts.companies.name}`,
  }));
}
