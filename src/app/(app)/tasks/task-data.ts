import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/domain/task-flow";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import type { TaskPerson, TaskRow } from "./task-view";

const taskRows = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    category: z.enum(TASK_CATEGORIES),
    project_name: z.string(),
    projects: z.object({ name: z.string() }).nullable(),
    assignee_id: z.uuid(),
    assigned_by: z.uuid(),
    priority: z.enum(TASK_PRIORITIES),
    due_on: z.iso.date(),
    status: z.enum(TASK_STATUSES),
    submitted_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    task_co_assignees: z.array(z.object({ profile_id: z.uuid() })),
    task_files: z.array(z.object({ count: z.number() })),
  }),
);

// Stamps are moments; the list shows the Malaysian day they fell on.
const dayOf = (moment: string | null) =>
  moment ? todayMyt(new Date(moment)) : null;

/** Every task this person may read; row-level security does the narrowing. */
export async function loadTasks(): Promise<TaskRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, category, project_name, projects(name), assignee_id, assigned_by, priority, due_on, status, submitted_at, completed_at, task_co_assignees(profile_id), task_files(count)",
    );
  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  return taskRows.parse(data).map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    projectLabel: row.projects?.name ?? row.project_name,
    status: row.status,
    assigneeId: row.assignee_id,
    coAssigneeIds: row.task_co_assignees.map((co) => co.profile_id),
    assignedBy: row.assigned_by,
    priority: row.priority,
    dueOn: row.due_on,
    submittedOn: dayOf(row.submitted_at),
    completedOn: dayOf(row.completed_at),
    fileCount: row.task_files[0]?.count ?? 0,
  }));
}

const personRows = z.array(
  z.object({
    id: z.uuid(),
    full_name: z.string().nullable(),
    job_role: JobRole,
  }),
);

/** Everyone still here with their job role, for the people who assign tasks and the two who see all of them. */
export async function loadTaskPeople(): Promise<TaskPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("task_people");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return personRows
    .parse(data)
    .map((row) => ({
      id: row.id,
      name: row.full_name ?? "Unnamed",
      jobRole: row.job_role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const projectRows = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

/** Projects a task can be about: every one not lost. */
export async function loadTaskProjects(): Promise<
  { id: string; label: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, contacts(companies(name))")
    .neq("stage", "lost")
    .order("name");
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return projectRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.name} · ${row.contacts.companies.name}`,
  }));
}
