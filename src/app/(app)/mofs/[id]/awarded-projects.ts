import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { AccountType } from "../../customers/schemas";

const awardedRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
    pic_id: z.string(),
    support_id: z.string().nullable(),
    commission_type: AccountType,
    contacts: z.object({
      name: z.string(),
      mobile: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Awarded projects that have no MOF yet, which a new MOF can start from. */
export async function loadAwardedProjects(supabase: Supabase) {
  const [projectsResult, linkedResult] = await Promise.all([
    supabase
      .from("projects")
      .select(
        "id, name, value, pic_id, support_id, commission_type, contacts(name, mobile, companies(name))",
      )
      .eq("stage", "awarded")
      .order("name"),
    supabase.from("mofs").select("project_id").not("project_id", "is", null),
  ]);
  if (projectsResult.error) {
    throw new Error(`Could not load projects: ${projectsResult.error.message}`);
  }
  if (linkedResult.error) {
    throw new Error(`Could not load MOFs: ${linkedResult.error.message}`);
  }
  const linked = new Set(
    z
      .array(z.object({ project_id: z.string() }))
      .parse(linkedResult.data)
      .map((row) => row.project_id),
  );
  return awardedRows
    .parse(projectsResult.data)
    .filter((project) => !linked.has(project.id));
}
