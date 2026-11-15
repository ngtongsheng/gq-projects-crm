import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import {
  approveTask,
  commentOnTask,
  createTask,
  editTask,
  moveTaskDueDate,
  reviseTask,
  startTask,
  submitTask,
} from "./actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/auth/team-directory", () => ({ getTeamDirectory: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ASSIGNER = "11111111-1111-4111-8111-111111111111";
const MAIN = "22222222-2222-4222-8222-222222222222";
const CO = "33333333-3333-4333-8333-333333333333";
const MD = "44444444-4444-4444-8444-444444444444";
const TASK = "55555555-5555-4555-8555-555555555555";

const signedIn = (id: string, jobRole: Profile["jobRole"]) =>
  vi.mocked(requirePage).mockResolvedValue({
    id,
    fullName: "Someone",
    role: "staff",
    jobRole,
    arrangesStock: false,
    sells: false,
    seesMargin: false,
    commissionMode: "standard",
    yearlyTarget: null,
    language: "en",
  });

type Result = { data: unknown; error: { code?: string } | null };
type Call = { table: string; op: string; payload: unknown; filters: unknown[] };

/** Each query takes the next result in line; calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = {
        table,
        op: "select",
        payload: undefined,
        filters: [],
      };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "delete"]) {
        query[step] = (payload?: unknown) => {
          call.op = step;
          call.payload = payload;
          return Object.assign(Promise.resolve(result), query);
        };
      }
      for (const step of ["select", "single", "maybeSingle"]) {
        query[step] = () => Object.assign(Promise.resolve(result), query);
      }
      for (const step of ["eq", "in"]) {
        query[step] = (...args: unknown[]) => {
          call.filters.push([step, ...args]);
          return Object.assign(Promise.resolve(result), query);
        };
      }
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

const row = (status: string, extra: Record<string, unknown> = {}) => ({
  data: {
    id: TASK,
    status,
    assignee_id: MAIN,
    assigned_by: ASSIGNER,
    priority: "normal",
    due_on: "2026-12-01",
    task_co_assignees: [{ profile_id: CO }],
    ...extra,
  },
  error: null,
});
const saved = { data: [{ id: TASK }], error: null };
const ok = { data: null, error: null };

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of [value].flat()) data.append(key, item);
  }
  return data;
}

const detailsForm = (fields: Record<string, string | string[]> = {}) =>
  form({
    title: " E-catalogue for SPC ",
    description: "",
    category: "e_catalogue",
    projectId: "",
    projectName: "",
    assigneeId: MAIN,
    coAssigneeIds: [CO],
    priority: "high",
    assignedOn: "2026-11-15",
    dueOn: "2026-11-20",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getTeamDirectory).mockResolvedValue([
    { id: MAIN, name: "Aina" },
    { id: CO, name: "Ben" },
  ]);
});

describe("createTask", () => {
  it("adds the task, who works with them, and logs who it went to", async () => {
    signedIn(ASSIGNER, "marketing");
    const calls = fakeSupabase({ data: { id: TASK }, error: null }, ok, ok);

    expect(await createTask(detailsForm())).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      table: "tasks",
      op: "insert",
      payload: {
        title: "E-catalogue for SPC",
        category: "e_catalogue",
        project_id: null,
        assignee_id: MAIN,
        priority: "high",
        due_on: "2026-11-20",
      },
    });
    expect(calls[1]).toMatchObject({
      table: "task_co_assignees",
      payload: [{ task_id: TASK, profile_id: CO }],
    });
    expect(calls[2]).toMatchObject({
      table: "task_log_entries",
      payload: {
        task_id: TASK,
        body: "Assigned to Aina + Ben, due 20 Nov 2026",
      },
    });
  });

  it("refuses job roles that do not assign", async () => {
    for (const role of [
      "sales",
      "accounts",
      "site",
      "ssup",
      "designer",
    ] as const) {
      signedIn(ASSIGNER, role);
      const calls = fakeSupabase();
      expect((await createTask(detailsForm())).error).toMatch(/assign tasks/);
      expect(calls).toHaveLength(0);
    }
  });

  it("refuses assigning to yourself and a due date before the assigned date", async () => {
    signedIn(ASSIGNER, "md");
    const calls = fakeSupabase();
    expect(
      (await createTask(detailsForm({ assigneeId: ASSIGNER }))).error,
    ).toMatch(/yourself/);
    expect(
      (await createTask(detailsForm({ coAssigneeIds: [ASSIGNER] }))).error,
    ).toMatch(/yourself/);
    expect(
      (await createTask(detailsForm({ dueOn: "2026-11-14" }))).error,
    ).toMatch(/before the date assigned/);
    expect(calls).toHaveLength(0);
  });

  it("drops the main assignee from working together with", async () => {
    signedIn(ASSIGNER, "md");
    const calls = fakeSupabase({ data: { id: TASK }, error: null }, ok);

    await createTask(detailsForm({ coAssigneeIds: [MAIN] }));

    expect(calls.map((call) => call.table)).toEqual([
      "tasks",
      "task_log_entries",
    ]);
  });
});

describe("editTask", () => {
  it("lets the assigner edit and logs a change of person, due date and priority", async () => {
    signedIn(ASSIGNER, "bd");
    const calls = fakeSupabase(row("in_progress"), saved, ok, ok);

    const result = await editTask(
      TASK,
      detailsForm({ assigneeId: CO, coAssigneeIds: [] }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[1]).toMatchObject({ table: "tasks", op: "update" });
    expect(calls[1]?.filters).toContainEqual(["eq", "status", "in_progress"]);
    expect(calls[2]).toMatchObject({
      table: "task_co_assignees",
      op: "delete",
    });
    expect(calls[3]).toMatchObject({
      table: "task_log_entries",
      payload: {
        body: "Edited: assigned to → Ben, due → 20 Nov 2026, priority → High",
      },
    });
  });

  it("refuses everyone but the assigner, and a completed task", async () => {
    for (const [id, role] of [
      [MAIN, "designer"],
      [MD, "md"],
    ] as const) {
      signedIn(id, role);
      const calls = fakeSupabase(row("in_progress"));
      expect((await editTask(TASK, detailsForm())).error).toMatch(
        /Only the person who assigned/,
      );
      expect(calls).toHaveLength(1);
    }
    signedIn(ASSIGNER, "bd");
    fakeSupabase(row("completed"));
    expect((await editTask(TASK, detailsForm())).error).toMatch(
      /Only the person who assigned/,
    );
  });
});

describe("status moves", () => {
  it("lets the main assignee start a new task", async () => {
    signedIn(MAIN, "designer");
    const calls = fakeSupabase(row("not_started"), saved, ok);

    expect(await startTask(TASK)).toEqual({ error: null });
    expect(calls[1]).toMatchObject({
      table: "tasks",
      payload: { status: "in_progress" },
    });
    expect(calls[2]).toMatchObject({ payload: { body: "Started" } });
  });

  it("lets a co-assignee submit with a note, sending only the status", async () => {
    signedIn(CO, "marketing");
    const calls = fakeSupabase(row("revision_required"), saved, ok);

    expect(await submitTask(TASK, " v2 attached ")).toEqual({ error: null });
    expect(calls[1]?.payload).toEqual({ status: "pending_review" });
    expect(calls[2]).toMatchObject({
      payload: { body: "Submitted for review · v2 attached" },
    });
  });

  it("refuses the assignee approving their own work", async () => {
    signedIn(MAIN, "md");
    const calls = fakeSupabase(row("pending_review"));

    expect((await approveTask(TASK, "")).error).toMatch(/cannot do that/);
    expect(calls).toHaveLength(1);
  });

  it("lets the assigner or the MD approve", async () => {
    for (const [id, role] of [
      [ASSIGNER, "bd"],
      [MD, "md"],
    ] as const) {
      signedIn(id, role);
      const calls = fakeSupabase(row("pending_review"), saved, ok);
      expect(await approveTask(TASK, "")).toEqual({ error: null });
      expect(calls[1]?.payload).toEqual({ status: "completed" });
      expect(calls[2]).toMatchObject({
        payload: { body: "Approved · completed" },
      });
    }
  });

  it("refuses the Sales Director approving a task they did not assign", async () => {
    signedIn(MD, "director");
    const calls = fakeSupabase(row("pending_review"));
    expect((await approveTask(TASK, "")).error).toMatch(/cannot do that/);
    expect(calls).toHaveLength(1);
  });

  it("refuses a revision without a comment before touching the database", async () => {
    signedIn(ASSIGNER, "bd");
    const calls = fakeSupabase();

    expect((await reviseTask(TASK, "   ")).error).toMatch(
      /what needs changing/,
    );
    expect(calls).toHaveLength(0);
  });

  it("sends back with the comment in the log", async () => {
    signedIn(ASSIGNER, "bd");
    const calls = fakeSupabase(row("pending_review"), saved, ok);

    expect(await reviseTask(TASK, "Logo too small")).toEqual({ error: null });
    expect(calls[1]?.payload).toEqual({ status: "revision_required" });
    expect(calls[2]).toMatchObject({
      payload: { body: "Revision required: Logo too small" },
    });
  });

  it("refuses moving a completed task", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(row("completed"));
    expect((await submitTask(TASK, "")).error).toMatch(/cannot do that/);
  });

  it("reports a task changed by someone else meanwhile", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(row("not_started"), { data: [], error: null });
    expect((await startTask(TASK)).error).toMatch(/just changed/);
  });

  it("reports a hidden task as not found", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase({ data: null, error: null });
    expect((await startTask(TASK)).error).toMatch(/Could not find/);
  });
});

describe("moveTaskDueDate", () => {
  it("lets the people on the task set a new expected date", async () => {
    signedIn(CO, "marketing");
    const calls = fakeSupabase(row("in_progress"), saved, ok);

    expect(await moveTaskDueDate(TASK, "2099-01-05", "Supplier late")).toEqual({
      error: null,
    });
    expect(calls[1]?.payload).toEqual({ due_on: "2099-01-05" });
    expect(calls[2]).toMatchObject({
      payload: { body: "New expected date 5 Jan 2099 · Supplier late" },
    });
  });

  it("refuses the assigner (they edit instead) and a date in the past", async () => {
    signedIn(ASSIGNER, "bd");
    fakeSupabase(row("in_progress"));
    expect((await moveTaskDueDate(TASK, "2099-01-05", "")).error).toMatch(
      /cannot do that/,
    );

    signedIn(MAIN, "designer");
    const calls = fakeSupabase();
    expect((await moveTaskDueDate(TASK, "2000-01-01", "")).error).toMatch(
      /past/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("commentOnTask", () => {
  it("logs a comment", async () => {
    signedIn(MD, "director");
    const calls = fakeSupabase(ok);

    expect(await commentOnTask(TASK, "Any update?")).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      table: "task_log_entries",
      payload: { task_id: TASK, body: "Comment: Any update?" },
    });
  });

  it("refuses an empty comment", async () => {
    signedIn(MD, "director");
    const calls = fakeSupabase();
    expect((await commentOnTask(TASK, " ")).error).toMatch(/Write a comment/);
    expect(calls).toHaveLength(0);
  });
});
