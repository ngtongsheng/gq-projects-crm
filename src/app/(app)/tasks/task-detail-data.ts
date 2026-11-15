import { z } from "zod";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/domain/task-flow";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import type { TaskRow } from "./task-view";

export type TaskFileRow = {
  id: string;
  fileName: string;
  kind: "reference" | "work";
  version: number | null;
  uploadedBy: string;
  uploadedAt: string;
};

export type TaskLogRow = {
  id: string;
  body: string;
  byId: string;
  at: string;
};

/** One task with everything the sheet shows. */
export type TaskDetail = Omit<TaskRow, "fileCount"> & {
  description: string;
  assignedOn: string;
  revisionCount: number;
  files: TaskFileRow[];
  /** Newest first. */
  log: TaskLogRow[];
};

const detailRow = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  category: z.enum(TASK_CATEGORIES),
  project_name: z.string(),
  projects: z.object({ name: z.string() }).nullable(),
  assignee_id: z.uuid(),
  assigned_by: z.uuid(),
  priority: z.enum(TASK_PRIORITIES),
  assigned_on: z.iso.date(),
  due_on: z.iso.date(),
  status: z.enum(TASK_STATUSES),
  revision_count: z.number(),
  submitted_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  task_co_assignees: z.array(z.object({ profile_id: z.uuid() })),
  task_files: z.array(
    z.object({
      id: z.uuid(),
      file_name: z.string(),
      kind: z.enum(["reference", "work"]),
      version: z.number().nullable(),
      uploaded_by: z.uuid(),
      uploaded_at: z.string(),
    }),
  ),
  task_log_entries: z.array(
    z.object({
      id: z.uuid(),
      body: z.string(),
      by_id: z.uuid(),
      at: z.string(),
    }),
  ),
});

const dayOf = (moment: string | null) =>
  moment ? todayMyt(new Date(moment)) : null;

/** The task for the sheet, or null when it does not exist or row-level security hides it. */
export async function loadTaskDetail(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, category, project_name, projects(name), assignee_id, assigned_by, priority, assigned_on, due_on, status, revision_count, submitted_at, completed_at, task_co_assignees(profile_id), task_files(id, file_name, kind, version, uploaded_by, uploaded_at), task_log_entries(id, body, by_id, at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the task: ${error.message}`);
  if (!data) return null;
  const row = detailRow.parse(data);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    projectLabel: row.projects?.name ?? row.project_name,
    status: row.status,
    assigneeId: row.assignee_id,
    coAssigneeIds: row.task_co_assignees.map((co) => co.profile_id),
    assignedBy: row.assigned_by,
    priority: row.priority,
    assignedOn: row.assigned_on,
    dueOn: row.due_on,
    revisionCount: row.revision_count,
    submittedOn: dayOf(row.submitted_at),
    completedOn: dayOf(row.completed_at),
    files: row.task_files
      .map((file) => ({
        id: file.id,
        fileName: file.file_name,
        kind: file.kind,
        version: file.version,
        uploadedBy: file.uploaded_by,
        uploadedAt: file.uploaded_at,
      }))
      .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)),
    log: row.task_log_entries
      .map((entry) => ({
        id: entry.id,
        body: entry.body,
        byId: entry.by_id,
        at: entry.at,
      }))
      .sort((a, b) => b.at.localeCompare(a.at)),
  };
}
