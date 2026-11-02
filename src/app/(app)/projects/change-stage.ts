"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth/require-section";
import { createClient } from "@/lib/supabase/server";
import type { ProjectResult } from "./actions";
import { ProjectStage, projectIdSchema } from "./schemas";

/** Moves a project to another stage from the pipeline. Who may do it is decided by the projects policy. */
export async function changeProjectStage(
  projectId: string,
  stage: string,
): Promise<ProjectResult> {
  await requireSection("projects");

  const id = projectIdSchema.safeParse(projectId);
  const nextStage = ProjectStage.safeParse(stage);
  if (!id.success || !nextStage.success) {
    return { error: "Could not find that project. Reload the page." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ stage: nextStage.data })
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("Could not change project stage", error);
    return { error: "Could not change the stage. Try again." };
  }
  if (data.length === 0) {
    return {
      error:
        "Only the person in charge, the supporting salesperson, the MD or the Sales Director can change this project.",
    };
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/projects");
  return { error: null };
}
