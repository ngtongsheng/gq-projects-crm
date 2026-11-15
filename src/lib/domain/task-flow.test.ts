import { describe, expect, it } from "vitest";
import {
  canAddReferenceFile,
  canAssignTasks,
  canEditTask,
  canMoveDueDate,
  canMoveTask,
  canSeeTask,
  daysOverdue,
  isDueThisWeek,
  isTaskEscalated,
  isTaskOverdue,
  statusAfter,
  TASK_STATUSES,
  type TaskMove,
  type TaskParties,
  type TaskStatus,
  type TaskViewer,
  taskMoves,
  taskReminderDates,
} from "./task-flow";

const ASSIGNER: TaskViewer = { id: "assigner", jobRole: "bd" };
const MAIN: TaskViewer = { id: "main", jobRole: "designer" };
const CO: TaskViewer = { id: "co", jobRole: "marketing" };
const MD: TaskViewer = { id: "md", jobRole: "md" };
const DIRECTOR: TaskViewer = { id: "director", jobRole: "director" };
const OTHER: TaskViewer = { id: "other", jobRole: "sales" };

const task = (status: TaskStatus, extra: Partial<TaskParties> = {}) => ({
  status,
  assigneeId: MAIN.id,
  coAssigneeIds: [CO.id],
  assignedBy: ASSIGNER.id,
  ...extra,
});

const MOVES: TaskMove[] = ["start", "submit", "approve", "revise"];

// Every status × person: the moves allowed, mirroring public.guard_task_write.
const ALLOWED: Record<TaskStatus, Record<string, TaskMove[]>> = {
  not_started: {
    main: ["start", "submit"],
    co: ["start", "submit"],
    assigner: [],
    md: [],
    director: [],
    other: [],
  },
  in_progress: {
    main: ["submit"],
    co: ["submit"],
    assigner: [],
    md: [],
    director: [],
    other: [],
  },
  pending_review: {
    main: [],
    co: [],
    assigner: ["approve", "revise"],
    md: ["approve", "revise"],
    director: [],
    other: [],
  },
  revision_required: {
    main: ["submit"],
    co: ["submit"],
    assigner: [],
    md: [],
    director: [],
    other: [],
  },
  completed: {
    main: [],
    co: [],
    assigner: [],
    md: [],
    director: [],
    other: [],
  },
};

describe("canMoveTask", () => {
  const people = [ASSIGNER, MAIN, CO, MD, DIRECTOR, OTHER];
  for (const status of TASK_STATUSES) {
    for (const viewer of people) {
      for (const move of MOVES) {
        const allowed = ALLOWED[status][viewer.id].includes(move);
        it(`${allowed ? "lets" : "refuses"} ${viewer.id} ${move} from ${status}`, () => {
          expect(canMoveTask(task(status), viewer, move)).toBe(allowed);
        });
      }
    }
  }

  it("refuses the MD reviewing a task the MD is on", () => {
    const mdOnIt = task("pending_review", { coAssigneeIds: [MD.id] });
    expect(canMoveTask(mdOnIt, MD, "approve")).toBe(false);
    expect(canMoveTask(mdOnIt, MD, "revise")).toBe(false);
  });

  it("refuses the assigner reviewing a task they also work on", () => {
    const selfReview = task("pending_review", { coAssigneeIds: [ASSIGNER.id] });
    expect(canMoveTask(selfReview, ASSIGNER, "approve")).toBe(false);
  });

  it("lets the MD who assigned the task review it", () => {
    const fromMd = task("pending_review", { assignedBy: MD.id });
    expect(taskMoves(fromMd, MD)).toEqual(["approve", "revise"]);
  });
});

describe("statusAfter", () => {
  it("names where each move lands", () => {
    expect(MOVES.map(statusAfter)).toEqual([
      "in_progress",
      "pending_review",
      "completed",
      "revision_required",
    ]);
  });
});

describe("taskMoves", () => {
  it("lists the main assignee's buttons on a new task", () => {
    expect(taskMoves(task("not_started"), MAIN)).toEqual(["start", "submit"]);
  });
});

describe("editing", () => {
  it("lets only the assigner edit the details, until completed", () => {
    expect(canEditTask(task("in_progress"), ASSIGNER)).toBe(true);
    expect(canEditTask(task("pending_review"), ASSIGNER)).toBe(true);
    expect(canEditTask(task("completed"), ASSIGNER)).toBe(false);
    for (const viewer of [MAIN, CO, MD, DIRECTOR, OTHER]) {
      expect(canEditTask(task("in_progress"), viewer)).toBe(false);
    }
  });

  it("lets only the assigner add reference files, until completed", () => {
    expect(canAddReferenceFile(task("not_started"), ASSIGNER)).toBe(true);
    expect(canAddReferenceFile(task("completed"), ASSIGNER)).toBe(false);
    for (const viewer of [MAIN, CO, MD, DIRECTOR, OTHER]) {
      expect(canAddReferenceFile(task("not_started"), viewer)).toBe(false);
    }
  });

  it("lets the people on the task move the due date, until completed", () => {
    expect(canMoveDueDate(task("in_progress"), MAIN)).toBe(true);
    expect(canMoveDueDate(task("revision_required"), CO)).toBe(true);
    expect(canMoveDueDate(task("completed"), MAIN)).toBe(false);
    for (const viewer of [ASSIGNER, MD, OTHER]) {
      expect(canMoveDueDate(task("in_progress"), viewer)).toBe(false);
    }
  });
});

describe("who sees and assigns", () => {
  it("shows a task to its people, its assigner, the MD and the Sales Director", () => {
    for (const viewer of [ASSIGNER, MAIN, CO, MD, DIRECTOR]) {
      expect(canSeeTask(task("in_progress"), viewer)).toBe(true);
    }
    expect(canSeeTask(task("in_progress"), OTHER)).toBe(false);
  });

  it("lets md, director, bd, support and marketing assign", () => {
    for (const role of [
      "md",
      "director",
      "bd",
      "support",
      "marketing",
    ] as const) {
      expect(canAssignTasks(role)).toBe(true);
    }
    for (const role of [
      "sales",
      "accounts",
      "site",
      "ssup",
      "designer",
    ] as const) {
      expect(canAssignTasks(role)).toBe(false);
    }
  });
});

describe("due dates", () => {
  // 2026-11-18 is a Wednesday.
  const TODAY = "2026-11-18";
  const due = (status: TaskStatus, dueOn: string) => ({ status, dueOn });

  it("counts a task overdue the day after its due date", () => {
    expect(isTaskOverdue(due("in_progress", "2026-11-18"), TODAY)).toBe(false);
    expect(isTaskOverdue(due("in_progress", "2026-11-17"), TODAY)).toBe(true);
    expect(daysOverdue(due("not_started", "2026-11-15"), TODAY)).toBe(3);
    expect(daysOverdue(due("not_started", "2026-11-20"), TODAY)).toBe(0);
  });

  it("does not count waiting for review or completed as overdue", () => {
    expect(isTaskOverdue(due("pending_review", "2026-11-01"), TODAY)).toBe(
      false,
    );
    expect(isTaskOverdue(due("completed", "2026-11-01"), TODAY)).toBe(false);
    expect(isTaskOverdue(due("revision_required", "2026-11-01"), TODAY)).toBe(
      true,
    );
  });

  it("counts due this week up to Sunday, today included, overdue excluded", () => {
    expect(isDueThisWeek(due("in_progress", "2026-11-18"), TODAY)).toBe(true);
    expect(isDueThisWeek(due("in_progress", "2026-11-22"), TODAY)).toBe(true);
    expect(isDueThisWeek(due("in_progress", "2026-11-23"), TODAY)).toBe(false);
    expect(isDueThisWeek(due("in_progress", "2026-11-17"), TODAY)).toBe(false);
    expect(isDueThisWeek(due("completed", "2026-11-20"), TODAY)).toBe(false);
    expect(isDueThisWeek(due("pending_review", "2026-11-20"), TODAY)).toBe(
      true,
    );
  });

  it("treats Sunday as the last day of the week", () => {
    expect(isDueThisWeek(due("in_progress", "2026-11-22"), "2026-11-22")).toBe(
      true,
    );
    expect(isDueThisWeek(due("in_progress", "2026-11-23"), "2026-11-22")).toBe(
      false,
    );
  });

  it("places reminders a day before, a day after and escalation two days after", () => {
    expect(taskReminderDates("2026-12-01")).toEqual({
      remindOn: "2026-11-30",
      remindAgainOn: "2026-12-02",
      escalateOn: "2026-12-03",
    });
    expect(
      taskReminderDates("2026-12-01", {
        daysBefore: 3,
        daysAfter: 2,
        escalateAfter: 5,
      }),
    ).toEqual({
      remindOn: "2026-11-28",
      remindAgainOn: "2026-12-03",
      escalateOn: "2026-12-06",
    });
  });

  it("escalates once two days overdue and still open", () => {
    expect(isTaskEscalated(due("in_progress", "2026-11-17"), TODAY)).toBe(
      false,
    );
    expect(isTaskEscalated(due("in_progress", "2026-11-16"), TODAY)).toBe(true);
    expect(isTaskEscalated(due("pending_review", "2026-11-01"), TODAY)).toBe(
      false,
    );
    expect(
      isTaskEscalated(due("in_progress", "2026-11-17"), TODAY, {
        daysBefore: 1,
        daysAfter: 1,
        escalateAfter: 1,
      }),
    ).toBe(true);
  });
});
