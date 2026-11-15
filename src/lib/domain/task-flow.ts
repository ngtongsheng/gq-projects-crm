import type { JobRole } from "@/lib/auth/job-role";
import {
  addDays,
  type CalendarDate,
  dayOfWeek,
  daysBetween,
} from "@/lib/format/date";

// Values mirror the check constraints in the tasks migration.
export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "pending_review",
  "revision_required",
  "completed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_CATEGORIES = [
  "customer_appointment",
  "follow_up_customer",
  "design",
  "e_catalogue",
  "sample_folder",
  "website_upload",
  "new_product",
  "product_launch",
  "training_material",
  "marketing_material",
  "other",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/** Adds tasks for others (loop 15 D4; SQL: the "tasks: assigners add their own" policy). */
export const canAssignTasks = (jobRole: JobRole) =>
  ["md", "director", "bd", "support", "marketing"].includes(jobRole);

export type TaskParties = {
  status: TaskStatus;
  assigneeId: string;
  coAssigneeIds: readonly string[];
  assignedBy: string;
};

export type TaskViewer = { id: string; jobRole: JobRole };

/** The main assignee or someone working together with them. */
export const isOnTask = (task: TaskParties, personId: string) =>
  task.assigneeId === personId || task.coAssigneeIds.includes(personId);

/** Who reads a task (SQL: public.can_see_task). */
export const canSeeTask = (task: TaskParties, viewer: TaskViewer) =>
  isOnTask(task, viewer.id) ||
  task.assignedBy === viewer.id ||
  viewer.jobRole === "md" ||
  viewer.jobRole === "director";

export type TaskMove = "start" | "submit" | "approve" | "revise";

// Mirrors public.guard_task_write: the people on the task start and submit it; the assigner or
// the MD, when not on the task, approves it or sends it back.
const MOVES: Record<
  TaskMove,
  { from: readonly TaskStatus[]; to: TaskStatus; by: "worker" | "reviewer" }
> = {
  start: { from: ["not_started"], to: "in_progress", by: "worker" },
  submit: {
    from: ["not_started", "in_progress", "revision_required"],
    to: "pending_review",
    by: "worker",
  },
  approve: { from: ["pending_review"], to: "completed", by: "reviewer" },
  revise: { from: ["pending_review"], to: "revision_required", by: "reviewer" },
};

export const statusAfter = (move: TaskMove): TaskStatus => MOVES[move].to;

export function canMoveTask(
  task: TaskParties,
  viewer: TaskViewer,
  move: TaskMove,
): boolean {
  const rule = MOVES[move];
  if (!rule.from.includes(task.status)) return false;
  const onTask = isOnTask(task, viewer.id);
  if (rule.by === "worker") return onTask;
  return !onTask && (task.assignedBy === viewer.id || viewer.jobRole === "md");
}

/** The buttons this person gets on the task sheet. */
export const taskMoves = (task: TaskParties, viewer: TaskViewer): TaskMove[] =>
  (Object.keys(MOVES) as TaskMove[]).filter((move) =>
    canMoveTask(task, viewer, move),
  );

/** Only the assigner edits the details; a completed task is frozen. */
export const canEditTask = (task: TaskParties, viewer: TaskViewer) =>
  task.status !== "completed" && task.assignedBy === viewer.id;

/** The assigner attaches reference files until the task is completed. */
export const canAddReferenceFile = (task: TaskParties, viewer: TaskViewer) =>
  task.status !== "completed" && task.assignedBy === viewer.id;

/** The people on the task may move the due date (demo "Can't make the due date?"). */
export const canMoveDueDate = (task: TaskParties, viewer: TaskViewer) =>
  task.status !== "completed" && isOnTask(task, viewer.id);

// Due dates and reminders, worked out when a page is read (loop 15 D3, no scheduled jobs).

type TaskDue = { status: TaskStatus; dueOn: CalendarDate };

/** Demo tkCfg: remind a day before, again a day after, escalate two days overdue. */
export type TaskReminderSettings = {
  daysBefore: number;
  daysAfter: number;
  escalateAfter: number;
};

export const TASK_REMINDER_DEFAULTS: TaskReminderSettings = {
  daysBefore: 1,
  daysAfter: 1,
  escalateAfter: 2,
};

/** Past the due date and still with the people on it; waiting for review is not late. */
export const isTaskOverdue = (task: TaskDue, today: CalendarDate) =>
  task.status !== "completed" &&
  task.status !== "pending_review" &&
  task.dueOn < today;

export const daysOverdue = (task: TaskDue, today: CalendarDate) =>
  isTaskOverdue(task, today) ? daysBetween(task.dueOn, today) : 0;

/** Open, not overdue, due by Sunday of this week (today included). */
export function isDueThisWeek(task: TaskDue, today: CalendarDate): boolean {
  if (task.status === "completed" || isTaskOverdue(task, today)) return false;
  const monday = addDays(today, -((dayOfWeek(today) + 6) % 7));
  return task.dueOn <= addDays(monday, 6);
}

/** When each reminder falls for a due date, in calendar days. */
export const taskReminderDates = (
  dueOn: CalendarDate,
  settings: TaskReminderSettings = TASK_REMINDER_DEFAULTS,
) => ({
  remindOn: addDays(dueOn, -settings.daysBefore),
  remindAgainOn: addDays(dueOn, settings.daysAfter),
  escalateOn: addDays(dueOn, settings.escalateAfter),
});

/** Overdue long enough to tell the assigner and the MD. */
export const isTaskEscalated = (
  task: TaskDue,
  today: CalendarDate,
  settings: TaskReminderSettings = TASK_REMINDER_DEFAULTS,
) =>
  isTaskOverdue(task, today) &&
  today >= taskReminderDates(task.dueOn, settings).escalateOn;
