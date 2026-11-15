"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canAddReferenceFile, canMoveTask } from "@/lib/domain/task-flow";
import { createReadLink } from "@/lib/storage/signed-url";
import { createUploadTarget, type UploadTarget } from "@/lib/storage/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isInTaskFolder, TaskFileInput } from "./task-file-input";
import { loadTask } from "./task-load";

const NOT_FOUND = "Could not find that task. Reload the page.";
const NOT_ALLOWED = "You cannot do that on this task.";
const NOT_AVAILABLE = "That file is not available.";

export type UploadTargetResult =
  | { error: string }
  | { error: null; target: UploadTarget };

const uploadForm = z.object({
  id: z.uuid({ error: NOT_FOUND }),
  kind: z.enum(["reference", "work"]),
  fileName: z.string(),
  contentType: z.string(),
  size: z.number(),
});

/**
 * Step one of a task upload: check the person may add this kind of file to this task, then hand
 * back a one-file upload token. Finished work is sent by the people on the task, reference
 * files by the assigner.
 */
export async function requestTaskUpload(
  id: string,
  kind: "reference" | "work",
  file: { fileName: string; contentType: string; size: number },
): Promise<UploadTargetResult> {
  const me = await requirePage("tasks");
  const parsed = uploadForm.safeParse({ id, kind, ...file });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the file." };
  }

  const supabase = await createClient();
  const task = await loadTask(supabase, parsed.data.id);
  if (!task) return { error: NOT_FOUND };
  const allowed =
    parsed.data.kind === "reference"
      ? canAddReferenceFile(task, me)
      : canMoveTask(task, me, "submit");
  if (!allowed) return { error: NOT_ALLOWED };

  const target = await createUploadTarget(supabase, {
    area: "tasks",
    recordId: task.id,
    fileName: parsed.data.fileName,
    contentType: parsed.data.contentType,
    size: parsed.data.size,
  });
  return target.ok
    ? { error: null, target: target.target }
    : { error: target.error };
}

/** The assigner attaches a reference file that was already uploaded. */
export async function addReferenceFile(
  id: string,
  file: unknown,
): Promise<{ error: string | null }> {
  const me = await requirePage("tasks");
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { error: NOT_FOUND };
  const parsedFile = TaskFileInput.safeParse(file);
  if (!parsedFile.success || !isInTaskFolder(parsedFile.data, parsedId.data)) {
    return { error: "The file could not be read. Upload it again." };
  }

  const supabase = await createClient();
  const task = await loadTask(supabase, parsedId.data);
  if (!task) return { error: NOT_FOUND };
  if (!canAddReferenceFile(task, me)) return { error: NOT_ALLOWED };

  const { error } = await supabase.from("task_files").insert({
    task_id: task.id,
    path: parsedFile.data.path,
    file_name: parsedFile.data.fileName,
    content_type: parsedFile.data.contentType,
    kind: "reference",
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    console.error("Could not add the reference file", error);
    return { error: "Could not save the file. Try again." };
  }
  revalidatePath("/tasks");
  return { error: null };
}

export type OpenFileResult = { error: string } | { error: null; url: string };

/** A short-lived link to one task file, for anyone who can see the task. */
export async function openTaskFile(id: string): Promise<OpenFileResult> {
  await requirePage("tasks");
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { error: NOT_AVAILABLE };

  // Row-level security hides the file of a task this person cannot see.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_files")
    .select("path")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) {
    console.error("Could not look up the task file", error);
    return { error: NOT_AVAILABLE };
  }
  if (!data) return { error: NOT_AVAILABLE };

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Files open on the preview link or the live site." };
  }
  const link = await createReadLink(
    admin,
    z.object({ path: z.string() }).parse(data).path,
  );
  return link.ok ? { error: null, url: link.url } : { error: link.error };
}
