import { z } from "zod";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskParties,
} from "@/lib/domain/task-flow";
import type { createClient } from "@/lib/supabase/server";

export type Supabase = Awaited<ReturnType<typeof createClient>>;

const taskRow = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
  assignee_id: z.uuid(),
  assigned_by: z.uuid(),
  priority: z.enum(TASK_PRIORITIES),
  due_on: z.iso.date(),
  task_co_assignees: z.array(z.object({ profile_id: z.uuid() })),
});

export type LoadedTask = TaskParties & {
  id: string;
  priority: z.infer<typeof taskRow>["priority"];
  dueOn: string;
};

/** The task as this person sees it, or null when row-level security hides it. */
export async function loadTask(
  supabase: Supabase,
  id: string,
): Promise<LoadedTask | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, status, assignee_id, assigned_by, priority, due_on, task_co_assignees(profile_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the task: ${error.message}`);
  if (!data) return null;
  const row = taskRow.parse(data);
  return {
    id: row.id,
    status: row.status,
    assigneeId: row.assignee_id,
    coAssigneeIds: row.task_co_assignees.map((co) => co.profile_id),
    assignedBy: row.assigned_by,
    priority: row.priority,
    dueOn: row.due_on,
  };
}
