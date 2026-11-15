import { describe, expect, it } from "vitest";
import {
  countGiven,
  countMine,
  dueNote,
  parseTaskParams,
  selectTasks,
  type TaskRow,
  taskBanner,
  taskListHref,
  taskTiles,
  viewsFor,
  workloadRows,
} from "./task-view";

const TODAY = "2026-11-18"; // a Wednesday
const ME = {
  id: "11111111-1111-4111-8111-111111111111",
  jobRole: "designer",
} as const;
const BOSS = {
  id: "22222222-2222-4222-8222-222222222222",
  jobRole: "marketing",
} as const;
const MD = {
  id: "33333333-3333-4333-8333-333333333333",
  jobRole: "md",
} as const;

const task = (extra: Partial<TaskRow>): TaskRow => ({
  id: crypto.randomUUID(),
  title: "Task",
  category: "design",
  projectLabel: "",
  status: "not_started",
  assigneeId: ME.id,
  coAssigneeIds: [],
  assignedBy: BOSS.id,
  priority: "normal",
  dueOn: "2026-11-25",
  submittedOn: null,
  completedOn: null,
  fileCount: 0,
  ...extra,
});

describe("viewsFor", () => {
  it("gives each role its tabs", () => {
    expect(viewsFor(ME)).toEqual(["mine"]);
    expect(viewsFor(BOSS)).toEqual(["mine", "given"]);
    expect(viewsFor(MD)).toEqual(["mine", "given", "all", "load"]);
    expect(viewsFor({ id: "d", jobRole: "director" })).toEqual([
      "mine",
      "given",
      "all",
      "load",
    ]);
  });
});

describe("parseTaskParams", () => {
  const tasks = [task({})];

  it("falls back from a tab the person does not get", () => {
    expect(parseTaskParams({ view: "all" }, tasks, ME).view).toBe("mine");
  });

  it("opens My tasks for an assigner with open tasks, else Assigned by me", () => {
    expect(
      parseTaskParams({}, [task({ assigneeId: BOSS.id })], BOSS).view,
    ).toBe("mine");
    expect(parseTaskParams({}, tasks, BOSS).view).toBe("given");
  });

  it("keeps a valid tab and ignores a bad filter", () => {
    expect(
      parseTaskParams(
        { view: "given", status: "nonsense", person: "x" },
        tasks,
        BOSS,
      ),
    ).toEqual({ view: "given", status: "open", person: "all" });
  });
});

describe("selectTasks", () => {
  const open = task({ dueOn: "2026-11-20" });
  const later = task({ dueOn: "2026-11-30" });
  const done = task({
    status: "completed",
    dueOn: "2026-11-01",
    completedOn: "2026-11-02",
  });
  const theirs = task({ assigneeId: MD.id, assignedBy: MD.id });
  const tasks = [later, done, open, theirs];
  const base = { view: "mine", status: "open", person: "all" } as const;

  it("lists the person's open tasks by due date", () => {
    expect(selectTasks(tasks, base, ME)).toEqual([open, later]);
  });

  it("shows completed tasks last when asked for all", () => {
    expect(selectTasks(tasks, { ...base, status: "all" }, ME)).toEqual([
      open,
      later,
      done,
    ]);
  });

  it("filters by status", () => {
    expect(selectTasks(tasks, { ...base, status: "completed" }, ME)).toEqual([
      done,
    ]);
  });

  it("Assigned by me lists what the person assigned, filtered by person", () => {
    expect(selectTasks(tasks, { ...base, view: "given" }, BOSS)).toEqual([
      open,
      later,
    ]);
    expect(
      selectTasks(tasks, { ...base, view: "all", person: MD.id }, MD),
    ).toEqual([theirs]);
  });

  it("sorts the more urgent first on the same day", () => {
    const urgent = task({ dueOn: "2026-11-20", priority: "urgent" });
    expect(selectTasks([open, urgent], base, ME)).toEqual([urgent, open]);
  });
});

describe("counts and tiles", () => {
  const tasks = [
    task({ dueOn: "2026-11-10" }), // overdue
    task({ status: "in_progress", dueOn: "2026-11-22" }), // Sunday: this week
    task({ status: "revision_required", dueOn: "2026-11-30" }),
    task({ status: "pending_review", dueOn: "2026-11-10" }), // waiting, not overdue
    task({
      status: "completed",
      dueOn: "2026-11-01",
      completedOn: "2026-11-01",
    }),
    task({ assigneeId: BOSS.id, assignedBy: ME.id }),
  ];

  it("counts open tasks on the tabs", () => {
    expect(countMine(tasks, ME)).toBe(4);
    expect(countGiven(tasks, BOSS)).toBe(4);
  });

  it("works out the tiles over the person's open tasks", () => {
    expect(taskTiles(tasks, ME.id, TODAY)).toEqual({
      overdue: 1,
      dueThisWeek: 2,
      revision: 1,
      waitingReview: 1,
    });
  });
});

describe("dueNote", () => {
  it("words the due date as the demo does", () => {
    expect(dueNote(task({ dueOn: "2026-11-15" }), TODAY)).toEqual({
      tone: "bad",
      text: "3d overdue",
    });
    expect(dueNote(task({ dueOn: TODAY }), TODAY).text).toBe("Due today");
    expect(dueNote(task({ dueOn: "2026-11-19" }), TODAY).text).toBe(
      "Due tomorrow",
    );
    expect(dueNote(task({ dueOn: "2026-11-25" }), TODAY).text).toBe(
      "in 7 days",
    );
  });

  it("shows when a task was submitted or finished", () => {
    expect(
      dueNote(
        task({ status: "pending_review", submittedOn: "2026-11-16" }),
        TODAY,
      ),
    ).toEqual({ tone: "plain", text: "submitted 16 Nov 2026" });
    expect(
      dueNote(task({ status: "completed", completedOn: "2026-11-17" }), TODAY),
    ).toEqual({ tone: "good", text: "Done 17 Nov 2026" });
  });
});

describe("workloadRows", () => {
  const people = [
    { id: ME.id, name: "Affifa", jobRole: "designer" as const },
    { id: BOSS.id, name: "Wai Mun", jobRole: "marketing" as const },
    { id: MD.id, name: "Vicky", jobRole: "md" as const },
  ];
  const tasks = [
    task({ title: "Old", dueOn: "2026-11-10" }),
    task({ title: "Older", dueOn: "2026-11-05", coAssigneeIds: [BOSS.id] }),
    task({ dueOn: "2026-11-20" }),
    task({ status: "pending_review", dueOn: "2026-11-21" }),
    task({
      status: "completed",
      completedOn: "2026-11-03",
      dueOn: "2026-11-03",
    }),
    task({
      status: "completed",
      completedOn: "2026-10-30",
      dueOn: "2026-10-30",
    }),
  ];

  it("counts per person, leaving out people with no tasks", () => {
    const rows = workloadRows(tasks, people, TODAY);
    expect(rows.map((row) => row.person.name)).toEqual(["Affifa", "Wai Mun"]);
    expect(rows[0]).toMatchObject({
      open: 4,
      overdue: 2,
      dueThisWeek: 2,
      waitingReview: 1,
      doneThisMonth: 1,
      oldestOverdue: { title: "Older", days: 13 },
    });
    expect(rows[1]).toMatchObject({ open: 1, oldestOverdue: { days: 13 } });
  });

  it("leaves the oldest overdue empty when nothing is late", () => {
    const rows = workloadRows([task({ dueOn: "2026-11-30" })], people, TODAY);
    expect(rows[0].oldestOverdue).toBeNull();
  });
});

describe("taskBanner", () => {
  const name = (id: string) => (id === BOSS.id ? "Wai Mun" : "Someone");

  it("is empty when nothing needs attention", () => {
    expect(
      taskBanner([task({ status: "in_progress" })], ME, TODAY, name),
    ).toBeNull();
  });

  it("lists new, overdue, soon and revision tasks in order, red when late", () => {
    const tasks = [
      task({ title: "Fresh", dueOn: "2026-11-30" }),
      task({ status: "in_progress", dueOn: "2026-11-10" }),
      task({ status: "in_progress", dueOn: "2026-11-19" }),
      task({ status: "revision_required", dueOn: "2026-11-30" }),
    ];
    expect(taskBanner(tasks, ME, TODAY, name)).toEqual({
      tone: "bad",
      parts: [
        "1 new: Fresh (Wai Mun)",
        "1 overdue",
        "1 due today / tomorrow",
        "1 revision required",
      ],
    });
  });

  it("tells the assigner and the MD what waits for their review", () => {
    const waiting = task({ status: "pending_review" });
    expect(taskBanner([waiting], BOSS, TODAY, name)).toEqual({
      tone: "warn",
      parts: ["1 waiting for your review"],
    });
    expect(taskBanner([waiting], MD, TODAY, name)?.parts).toHaveLength(1);
    expect(taskBanner([waiting], ME, TODAY, name)).toBeNull();
  });
});

describe("taskListHref", () => {
  const params = { view: "given", status: "open", person: "all" } as const;

  it("keeps the tab and filters and adds the task to open", () => {
    expect(taskListHref(params, "abc")).toBe(
      "/tasks?view=given&status=open&person=all&task=abc",
    );
  });

  it("drops the task to close the sheet", () => {
    expect(taskListHref(params)).toBe(
      "/tasks?view=given&status=open&person=all",
    );
  });
});
