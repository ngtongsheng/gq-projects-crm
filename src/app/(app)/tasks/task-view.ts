import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import {
  canAssignTasks,
  daysOverdue,
  isDueThisWeek,
  isOnTask,
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskCategory,
  type TaskParties,
  type TaskPriority,
  type TaskViewer,
} from "@/lib/domain/task-flow";
import { type CalendarDate, daysBetween, formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";

/** One task as the list shows it. */
export type TaskRow = TaskParties & {
  id: string;
  title: string;
  category: TaskCategory;
  /** The project's name, or the customer or project the assigner typed. */
  projectLabel: string;
  priority: TaskPriority;
  dueOn: CalendarDate;
  submittedOn: CalendarDate | null;
  completedOn: CalendarDate | null;
  fileCount: number;
};

export const TASK_VIEWS = ["mine", "given", "all", "load"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const TASK_VIEW_LABEL: Record<TaskView, string> = {
  mine: "My tasks",
  given: "Assigned by me",
  all: "All tasks",
  load: "Workload",
};

const isOpen = (task: TaskParties) => task.status !== "completed";

/** The tabs this person gets (demo vTasks: canAssign, and md or director). */
export function viewsFor(viewer: TaskViewer): TaskView[] {
  const sees = viewer.jobRole === "md" || viewer.jobRole === "director";
  return [
    "mine",
    ...(canAssignTasks(viewer.jobRole) ? (["given"] as const) : []),
    ...(sees ? (["all", "load"] as const) : []),
  ];
}

export const countMine = (tasks: readonly TaskRow[], viewer: TaskViewer) =>
  tasks.filter((task) => isOnTask(task, viewer.id) && isOpen(task)).length;

export const countGiven = (tasks: readonly TaskRow[], viewer: TaskViewer) =>
  tasks.filter((task) => task.assignedBy === viewer.id && isOpen(task)).length;

const StatusFilter = z.union([
  z.literal("open"),
  z.literal("all"),
  z.enum(TASK_STATUSES),
]);
export type StatusFilter = z.infer<typeof StatusFilter>;

export type TaskParams = {
  view: TaskView;
  status: StatusFilter;
  /** A person's id, or "all". */
  person: string;
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The tab and filters from the address. A tab the person does not get falls back to the demo's
 * default: My tasks when they have open ones or cannot assign, otherwise Assigned by me.
 */
export function parseTaskParams(
  params: Record<string, string | string[] | undefined>,
  tasks: readonly TaskRow[],
  viewer: TaskViewer,
): TaskParams {
  const views = viewsFor(viewer);
  const asked = first(params.view);
  const fallback: TaskView =
    countMine(tasks, viewer) > 0 || !views.includes("given") ? "mine" : "given";
  const view = views.find((candidate) => candidate === asked) ?? fallback;
  const person = first(params.person);
  return {
    view,
    status: StatusFilter.catch("open").parse(first(params.status)),
    person: person && z.uuid().safeParse(person).success ? person : "all",
  };
}

const priorityRank = (priority: TaskPriority) =>
  TASK_PRIORITIES.indexOf(priority);

/** Open tasks first, by due date, the more urgent first (demo tkSort). */
export const sortTasks = (tasks: readonly TaskRow[]): TaskRow[] =>
  [...tasks].sort(
    (a, b) =>
      Number(a.status === "completed") - Number(b.status === "completed") ||
      a.dueOn.localeCompare(b.dueOn) ||
      priorityRank(b.priority) - priorityRank(a.priority),
  );

/** The rows of a list tab, filtered and sorted. Workload is not a list. */
export function selectTasks(
  tasks: readonly TaskRow[],
  { view, status, person }: TaskParams,
  viewer: TaskViewer,
): TaskRow[] {
  const inView = tasks.filter((task) => {
    if (view === "mine") return isOnTask(task, viewer.id);
    if (view === "given") return task.assignedBy === viewer.id;
    return true;
  });
  return sortTasks(
    inView.filter(
      (task) =>
        (status === "all" ||
          (status === "open" ? isOpen(task) : task.status === status)) &&
        // The demo offers the person filter on the other tabs only.
        (view === "mine" || person === "all" || isOnTask(task, person)),
    ),
  );
}

/** Everyone who is on at least one task, for the person filter. */
export const peopleOnTasks = (tasks: readonly TaskRow[]): string[] => [
  ...new Set(tasks.flatMap((task) => [task.assigneeId, ...task.coAssigneeIds])),
];

export type TaskTiles = {
  overdue: number;
  dueThisWeek: number;
  revision: number;
  waitingReview: number;
};

/** The tiles over this person's open tasks (demo tkTiles). */
export function taskTiles(
  tasks: readonly TaskRow[],
  personId: string,
  today: CalendarDate,
): TaskTiles {
  const open = tasks.filter((task) => isOnTask(task, personId) && isOpen(task));
  return {
    overdue: open.filter((task) => isTaskOverdue(task, today)).length,
    dueThisWeek: open.filter((task) => isDueThisWeek(task, today)).length,
    revision: open.filter((task) => task.status === "revision_required").length,
    waitingReview: open.filter((task) => task.status === "pending_review")
      .length,
  };
}

export type DueNote = {
  tone: "good" | "warn" | "bad" | "plain";
  text: string;
};

/** The line under the due date (demo tkDueTxt). */
export function dueNote(
  task: Pick<TaskRow, "status" | "dueOn" | "submittedOn" | "completedOn">,
  today: CalendarDate,
  t: Translate = (text) => text,
): DueNote {
  if (task.status === "completed") {
    return {
      tone: "good",
      text: `${t("Done")} ${formatDate(task.completedOn ?? task.dueOn)}`,
    };
  }
  if (task.status === "pending_review") {
    return {
      tone: "plain",
      text: `${t("submitted")} ${formatDate(task.submittedOn ?? today)}`,
    };
  }
  const late = daysOverdue(task, today);
  if (late > 0) return { tone: "bad", text: `${late}d ${t("overdue")}` };
  const days = daysBetween(today, task.dueOn);
  if (days === 0) return { tone: "warn", text: t("Due today") };
  if (days === 1) return { tone: "warn", text: t("Due tomorrow") };
  return { tone: "plain", text: `${t("in")} ${days} ${t("days")}` };
}

/** The address of the task list with the sheet open on a task, or closed when no id is given. */
export function taskListHref(params: TaskParams, taskId?: string): string {
  const query = new URLSearchParams({
    view: params.view,
    status: params.status,
    person: params.person,
  });
  if (taskId) query.set("task", taskId);
  return `/tasks?${query}`;
}

export type TaskPerson = { id: string; name: string; jobRole: JobRole };

export type WorkloadRow = {
  person: TaskPerson;
  open: number;
  overdue: number;
  dueThisWeek: number;
  waitingReview: number;
  doneThisMonth: number;
  oldestOverdue: { title: string; days: number } | null;
};

/** Open tasks per person, for everyone still here who is on at least one task (demo Workload). */
export function workloadRows(
  tasks: readonly TaskRow[],
  people: readonly TaskPerson[],
  today: CalendarDate,
): WorkloadRow[] {
  const month = today.slice(0, 7);
  return people.flatMap((person) => {
    const theirs = tasks.filter((task) => isOnTask(task, person.id));
    if (theirs.length === 0) return [];
    const open = theirs.filter(isOpen);
    const oldest = open
      .filter((task) => isTaskOverdue(task, today))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
    return [
      {
        person,
        open: open.length,
        overdue: open.filter((task) => isTaskOverdue(task, today)).length,
        // The demo counts from today, so a late task waiting for review is not "this week".
        dueThisWeek: open.filter(
          (task) => task.dueOn >= today && isDueThisWeek(task, today),
        ).length,
        waitingReview: open.filter((task) => task.status === "pending_review")
          .length,
        doneThisMonth: theirs.filter((task) =>
          task.completedOn?.startsWith(month),
        ).length,
        oldestOverdue: oldest
          ? { title: oldest.title, days: daysOverdue(oldest, today) }
          : null,
      },
    ];
  });
}

export type TaskBanner = { tone: "bad" | "warn"; parts: string[] };

/** What needs this person's attention, in the demo's order (tkBanner); null when nothing does. */
export function taskBanner(
  tasks: readonly TaskRow[],
  viewer: TaskViewer,
  today: CalendarDate,
  nameOf: (personId: string) => string,
  t: Translate = (text) => text,
): TaskBanner | null {
  const mine = tasks.filter(
    (task) => isOnTask(task, viewer.id) && isOpen(task),
  );
  const late = mine.filter((task) => isTaskOverdue(task, today));
  const soon = mine.filter(
    (task) => !late.includes(task) && daysBetween(today, task.dueOn) <= 1,
  );
  const toReview = tasks.filter(
    (task) =>
      task.status === "pending_review" &&
      (task.assignedBy === viewer.id || viewer.jobRole === "md"),
  );
  const revision = mine.filter((task) => task.status === "revision_required");
  const fresh = mine.filter(
    (task) =>
      task.status === "not_started" &&
      !late.includes(task) &&
      !soon.includes(task),
  );
  const parts = [
    fresh.length > 0 &&
      `${fresh.length} ${t("new")}: ${fresh
        .slice(0, 2)
        .map((task) => `${task.title} (${nameOf(task.assignedBy)})`)
        .join(", ")}`,
    late.length > 0 && `${late.length} ${t("overdue")}`,
    soon.length > 0 && `${soon.length} ${t("due today / tomorrow")}`,
    revision.length > 0 && `${revision.length} ${t("revision required")}`,
    toReview.length > 0 && `${toReview.length} ${t("waiting for your review")}`,
  ].filter((part): part is string => part !== false);
  return parts.length > 0
    ? { tone: late.length > 0 ? "bad" : "warn", parts }
    : null;
}
