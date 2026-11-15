"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  canAssignTasks,
  canEditTask,
  canMoveDueDate,
  canMoveTask,
  statusAfter,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  type TaskMove,
  type TaskParties,
} from "@/lib/domain/task-flow";
import { optionalId, textField } from "@/lib/form/form-fields";
import { formatDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type TaskResult = { error: string | null };

const NOT_ASSIGNER =
  "Only the MD, Sales Director, Marketing Director, Purchasing and Marketing assign tasks.";
const NOT_FOUND = "Could not find that task. Reload the page.";
const CHANGED = "This task has just changed. Reload the page.";
const NOT_ALLOWED = "You cannot do that on this task.";
const TRY_AGAIN = "Could not save. Try again.";

const note = (label: string) =>
  z.string().trim().max(1500, `Keep the ${label} under 1500 characters.`);

const taskId = z.uuid({ error: NOT_FOUND });

const detailsForm = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Add a title.")
      .max(200, "Keep the title under 200 characters."),
    description: z
      .string()
      .trim()
      .max(4000, "Keep the details under 4000 characters."),
    category: z.enum(TASK_CATEGORIES, "Choose the type of task."),
    projectId: optionalId("Choose the project again."),
    projectName: z
      .string()
      .trim()
      .max(200, "Keep the customer or project name under 200 characters."),
    assigneeId: z.uuid({ error: "Choose who does the task." }),
    coAssigneeIds: z.array(
      z.uuid({ error: "Choose who works with them again." }),
    ),
    priority: z.enum(TASK_PRIORITIES, "Choose the priority."),
    assignedOn: z.iso.date("Choose the date assigned."),
    dueOn: z.iso.date("Choose the due date."),
  })
  .refine((form) => form.dueOn >= form.assignedOn, {
    message: "The due date is before the date assigned.",
    path: ["dueOn"],
  });
type TaskDetails = z.infer<typeof detailsForm>;

function readDetails(
  formData: FormData,
  me: string,
): { error: string } | { details: TaskDetails } {
  const parsed = detailsForm.safeParse({
    title: textField(formData, "title"),
    description: textField(formData, "description"),
    category: textField(formData, "category"),
    projectId: textField(formData, "projectId"),
    projectName: textField(formData, "projectName"),
    assigneeId: textField(formData, "assigneeId"),
    coAssigneeIds: formData.getAll("coAssigneeIds"),
    priority: textField(formData, "priority"),
    assignedOn: textField(formData, "assignedOn"),
    dueOn: textField(formData, "dueOn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const details = parsed.data;
  // The demo drops the main assignee from "working together with".
  const coAssigneeIds = [...new Set(details.coAssigneeIds)].filter(
    (id) => id !== details.assigneeId,
  );
  if (details.assigneeId === me || coAssigneeIds.includes(me)) {
    return { error: "You cannot assign a task to yourself." };
  }
  return { details: { ...details, coAssigneeIds } };
}

const taskColumns = (details: TaskDetails) => ({
  title: details.title,
  description: details.description,
  category: details.category,
  project_id: details.projectId,
  project_name: details.projectName,
  assignee_id: details.assigneeId,
  priority: details.priority,
  assigned_on: details.assignedOn,
  due_on: details.dueOn,
});

const taskRow = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
  assignee_id: z.uuid(),
  assigned_by: z.uuid(),
  priority: z.enum(TASK_PRIORITIES),
  due_on: z.iso.date(),
  task_co_assignees: z.array(z.object({ profile_id: z.uuid() })),
});
type LoadedTask = TaskParties & {
  id: string;
  priority: z.infer<typeof taskRow>["priority"];
  dueOn: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The task as this person sees it, or null when row-level security hides it. */
async function loadTask(
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

// The change is already saved when the log is written; a lost log line is logged, not shown
// (docs/debt.md, task log not atomic).
async function writeLog(supabase: Supabase, id: string, body: string) {
  const { error } = await supabase
    .from("task_log_entries")
    .insert({ task_id: id, body });
  if (error) console.error("Could not write the task log", error);
}

async function namesOf(ids: readonly string[]) {
  const team = await getTeamDirectory();
  return ids
    .map((id) => team.find((member) => member.id === id)?.name ?? "Unnamed")
    .join(" + ");
}

function saveError(error: { code?: string }, what: string): TaskResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  if (error.code === "23503") {
    return { error: "A person or project was not found. Reload the page." };
  }
  console.error(`Could not ${what}`, error);
  return { error: TRY_AGAIN };
}

/** Adds a task for others, with who works together on it, and logs who it went to. */
export async function createTask(formData: FormData): Promise<TaskResult> {
  const me = await requirePage("tasks");
  if (!canAssignTasks(me.jobRole)) return { error: NOT_ASSIGNER };

  const read = readDetails(formData, me.id);
  if ("error" in read) return { error: read.error };
  const { details } = read;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(taskColumns(details))
    .select("id")
    .single();
  if (error) return saveError(error, "add the task");

  if (details.coAssigneeIds.length > 0) {
    const { error: coError } = await supabase.from("task_co_assignees").insert(
      details.coAssigneeIds.map((profileId) => ({
        task_id: data.id,
        profile_id: profileId,
      })),
    );
    if (coError) return saveError(coError, "add who works on the task");
  }

  const people = await namesOf([details.assigneeId, ...details.coAssigneeIds]);
  await writeLog(
    supabase,
    data.id,
    `Assigned to ${people}, due ${formatDate(details.dueOn)}`,
  );
  revalidatePath("/tasks");
  return { error: null };
}

/** The assigner changes the details; who works together on it is replaced as a whole. */
export async function editTask(
  id: string,
  formData: FormData,
): Promise<TaskResult> {
  const me = await requirePage("tasks");
  const parsedId = taskId.safeParse(id);
  if (!parsedId.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const task = await loadTask(supabase, parsedId.data);
  if (!task) return { error: NOT_FOUND };
  if (!canEditTask(task, me)) {
    return { error: "Only the person who assigned the task edits it." };
  }

  const read = readDetails(formData, me.id);
  if ("error" in read) return { error: read.error };
  const { details } = read;

  const { data, error } = await supabase
    .from("tasks")
    .update(taskColumns(details))
    .eq("id", task.id)
    .eq("status", task.status)
    .select("id");
  if (error) return saveError(error, "edit the task");
  if (data.length === 0) return { error: CHANGED };

  const removed = task.coAssigneeIds.filter(
    (profileId) => !details.coAssigneeIds.includes(profileId),
  );
  const added = details.coAssigneeIds.filter(
    (profileId) => !task.coAssigneeIds.includes(profileId),
  );
  if (removed.length > 0) {
    const { error: removeError } = await supabase
      .from("task_co_assignees")
      .delete()
      .eq("task_id", task.id)
      .in("profile_id", removed);
    if (removeError) return saveError(removeError, "change who works on it");
  }
  if (added.length > 0) {
    const { error: addError } = await supabase
      .from("task_co_assignees")
      .insert(
        added.map((profileId) => ({ task_id: task.id, profile_id: profileId })),
      );
    if (addError) return saveError(addError, "change who works on it");
  }

  // Demo tkSave: the log names a change of person, due date or priority.
  const changes: string[] = [];
  if (details.assigneeId !== task.assigneeId) {
    changes.push(`assigned to → ${await namesOf([details.assigneeId])}`);
  }
  if (details.dueOn !== task.dueOn) {
    changes.push(`due → ${formatDate(details.dueOn)}`);
  }
  if (details.priority !== task.priority) {
    changes.push(`priority → ${TASK_PRIORITY_LABEL[details.priority]}`);
  }
  await writeLog(
    supabase,
    task.id,
    changes.length > 0 ? `Edited: ${changes.join(", ")}` : "Edited",
  );
  revalidatePath("/tasks");
  return { error: null };
}

const moveForm = z.object({
  id: taskId,
  comment: note("comment"),
});

const MOVE_LOG: Record<TaskMove, (comment: string) => string> = {
  start: () => "Started",
  submit: (comment) =>
    comment ? `Submitted for review · ${comment}` : "Submitted for review",
  approve: (comment) =>
    comment ? `Approved · completed · ${comment}` : "Approved · completed",
  revise: (comment) => `Revision required: ${comment}`,
};

/**
 * Moves a task along its flow. The database checks the same rules and stamps the submit,
 * approval and revision count itself, so only the status is sent.
 */
async function moveTask(
  move: TaskMove,
  id: string,
  comment: string,
): Promise<TaskResult> {
  const me = await requirePage("tasks");
  const parsed = moveForm.safeParse({ id, comment });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  if (move === "revise" && parsed.data.comment === "") {
    return { error: "Write what needs changing." };
  }

  const supabase = await createClient();
  const task = await loadTask(supabase, parsed.data.id);
  if (!task) return { error: NOT_FOUND };
  if (!canMoveTask(task, me, move)) return { error: NOT_ALLOWED };

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: statusAfter(move) })
    .eq("id", task.id)
    .eq("status", task.status)
    .select("id");
  if (error) return saveError(error, `${move} the task`);
  if (data.length === 0) return { error: CHANGED };

  await writeLog(supabase, task.id, MOVE_LOG[move](parsed.data.comment));
  revalidatePath("/tasks");
  return { error: null };
}

export async function startTask(id: string): Promise<TaskResult> {
  return moveTask("start", id, "");
}

export async function submitTask(
  id: string,
  comment: string,
): Promise<TaskResult> {
  return moveTask("submit", id, comment);
}

export async function approveTask(
  id: string,
  comment: string,
): Promise<TaskResult> {
  return moveTask("approve", id, comment);
}

/** Sends a task back; a revision always says what needs changing. */
export async function reviseTask(
  id: string,
  comment: string,
): Promise<TaskResult> {
  return moveTask("revise", id, comment);
}

const dueDateForm = z.object({
  id: taskId,
  dueOn: z.iso.date("Choose the new date."),
  comment: note("note"),
});

/** The people on the task set a new expected date (demo "Can't make the due date?"). */
export async function moveTaskDueDate(
  id: string,
  dueOn: string,
  comment: string,
): Promise<TaskResult> {
  const me = await requirePage("tasks");
  const parsed = dueDateForm.safeParse({ id, dueOn, comment });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  if (parsed.data.dueOn < todayMyt()) {
    return { error: "The new date cannot be in the past." };
  }

  const supabase = await createClient();
  const task = await loadTask(supabase, parsed.data.id);
  if (!task) return { error: NOT_FOUND };
  if (!canMoveDueDate(task, me)) return { error: NOT_ALLOWED };
  if (parsed.data.dueOn === task.dueOn) return { error: null };

  const { data, error } = await supabase
    .from("tasks")
    .update({ due_on: parsed.data.dueOn })
    .eq("id", task.id)
    .eq("status", task.status)
    .select("id");
  if (error) {
    // The due_on >= assigned_on check.
    if (error.code === "23514") {
      return { error: "The new date is before the date assigned." };
    }
    return saveError(error, "move the due date");
  }
  if (data.length === 0) return { error: CHANGED };

  const body = `New expected date ${formatDate(parsed.data.dueOn)}`;
  await writeLog(
    supabase,
    task.id,
    parsed.data.comment ? `${body} · ${parsed.data.comment}` : body,
  );
  revalidatePath("/tasks");
  return { error: null };
}

const commentForm = z.object({
  id: taskId,
  comment: note("comment").min(1, "Write a comment."),
});

/** Anyone who can see the task comments on it, even once completed. */
export async function commentOnTask(
  id: string,
  comment: string,
): Promise<TaskResult> {
  await requirePage("tasks");
  const parsed = commentForm.safeParse({ id, comment });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_log_entries").insert({
    task_id: parsed.data.id,
    body: `Comment: ${parsed.data.comment}`,
  });
  if (error) {
    // Row-level security refuses a task this person cannot see.
    if (error.code === "42501" || error.code === "23503") {
      return { error: NOT_FOUND };
    }
    console.error("Could not save the task comment", error);
    return { error: TRY_AGAIN };
  }
  revalidatePath("/tasks");
  return { error: null };
}
