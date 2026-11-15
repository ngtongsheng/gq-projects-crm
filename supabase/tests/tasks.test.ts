import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobRole } from "@/lib/auth/job-role";
import { createTestDatabase, type TestDatabase } from "./harness";

// Loop 15 task 01: the marketing executive assigns a task to the designer, working together
// with sales support. Those three, the MD and the Sales Director see it; nobody else does.
// Only the assigner or the MD, when not on the task, approves or sends it back.

let t: TestDatabase;
let taskId: string;

async function query<T>(who: JobRole, sql: string, params: unknown[] = []) {
  await t.actAs(who);
  const { rows } = await t.db.query<T>(sql, params);
  return rows;
}

async function idsIn(who: JobRole, table: string, column = "id") {
  const rows = await query<{ id: string }>(
    who,
    `select ${column} as id from public.${table}`,
  );
  return rows.map((row) => row.id);
}

async function addTask(who: JobRole, assignee: JobRole) {
  const [task] = await query<{ id: string }>(
    who,
    `insert into public.tasks (title, category, assignee_id, priority, due_on)
     values ('E-catalogue for SPC range', 'e_catalogue', $1, 'high', current_date + 3)
     returning id`,
    [t.profileIds[assignee]],
  );
  return task.id;
}

async function setStatus(who: JobRole, status: string) {
  return query(who, "update public.tasks set status = $1 where id = $2", [
    status,
    taskId,
  ]);
}

async function task() {
  await t.actAs(null);
  const { rows } = await t.db.query<{
    status: string;
    revision_count: number;
    approved_by: string | null;
    submitted_at: Date | null;
  }>(
    "select status, revision_count, approved_by, submitted_at from public.tasks where id = $1",
    [taskId],
  );
  return rows[0];
}

function filePath(name: string) {
  return `tasks/${taskId}/1a2b3c4d-${name}`;
}

beforeAll(async () => {
  t = await createTestDatabase();
  taskId = await addTask("marketing", "designer");
  await query(
    "marketing",
    "insert into public.task_co_assignees (task_id, profile_id) values ($1, $2)",
    [taskId, t.profileIds.ssup],
  );
});

afterAll(async () => {
  await t.close();
});

describe("who assigns", () => {
  it.each<JobRole>([
    "md",
    "director",
    "bd",
    "support",
  ])("%s may assign", async (who) => {
    await expect(addTask(who, "designer")).resolves.toBeTruthy();
  });

  it.each<JobRole>([
    "sales",
    "designer",
    "accounts",
    "site",
    "ssup",
  ])("%s may not", async (who) => {
    await expect(addTask(who, "designer")).rejects.toThrow();
  });

  it("nobody assigns in someone else's name", async () => {
    await expect(
      query(
        "marketing",
        `insert into public.tasks (title, assignee_id, assigned_by, due_on)
         values ('X', $1, $2, current_date)`,
        [t.profileIds.designer, t.profileIds.md],
      ),
    ).rejects.toThrow();
  });
});

describe("who sees a task", () => {
  it.each<JobRole>([
    "marketing",
    "designer",
    "ssup",
    "md",
    "director",
  ])("%s sees it, its co-assignees, log and files", async (who) => {
    expect(await idsIn(who, "tasks")).toContain(taskId);
    expect(await idsIn(who, "task_co_assignees", "task_id")).toContain(taskId);
  });

  it.each<JobRole>([
    "sales",
    "accounts",
    "site",
    "support",
    "bd",
  ])("%s does not", async (who) => {
    expect(await idsIn(who, "tasks")).not.toContain(taskId);
    expect(await idsIn(who, "task_co_assignees", "task_id")).toEqual([]);
  });

  it("an unrelated person cannot write in its log", async () => {
    await expect(
      query(
        "sales",
        "insert into public.task_log_entries (task_id, body) values ($1, 'Hi')",
        [taskId],
      ),
    ).rejects.toThrow();
  });

  it("everyone on it shares one log", async () => {
    await query(
      "ssup",
      "insert into public.task_log_entries (task_id, body) values ($1, 'Text is ready')",
      [taskId],
    );
    const rows = await query<{ body: string; by_id: string }>(
      "designer",
      "select body, by_id from public.task_log_entries where task_id = $1",
      [taskId],
    );
    expect(rows).toEqual([{ body: "Text is ready", by_id: t.profileIds.ssup }]);
    expect(await idsIn("sales", "task_log_entries")).toEqual([]);
  });

  it("only the assigner adds a co-assignee", async () => {
    await expect(
      query(
        "designer",
        "insert into public.task_co_assignees (task_id, profile_id) values ($1, $2)",
        [taskId, t.profileIds.sales],
      ),
    ).rejects.toThrow();
  });
});

describe("files", () => {
  it("the assigner adds reference files, the people on it add work", async () => {
    await query(
      "marketing",
      `insert into public.task_files (task_id, path, file_name, content_type, kind)
       values ($1, $2, 'brief.pdf', 'application/pdf', 'reference')`,
      [taskId, filePath("brief.pdf")],
    );
    await query(
      "ssup",
      `insert into public.task_files (task_id, path, file_name, content_type, kind, version)
       values ($1, $2, 'v1.pdf', 'application/pdf', 'work', 1)`,
      [taskId, filePath("v1.pdf")],
    );
    expect(await idsIn("director", "task_files")).toHaveLength(2);
    expect(await idsIn("sales", "task_files")).toEqual([]);
  });

  it("the designer cannot add a reference file", async () => {
    await expect(
      query(
        "designer",
        `insert into public.task_files (task_id, path, file_name, content_type, kind)
         values ($1, $2, 'x.pdf', 'application/pdf', 'reference')`,
        [taskId, filePath("x.pdf")],
      ),
    ).rejects.toThrow();
  });

  it("a file must sit in the task's own folder", async () => {
    await expect(
      query(
        "designer",
        `insert into public.task_files (task_id, path, file_name, content_type, kind, version)
         values ($1, 'leave/00000000-0000-0000-0000-000000000000/a.pdf', 'a.pdf', 'application/pdf', 'work', 1)`,
        [taskId],
      ),
    ).rejects.toThrow();
  });
});

describe("status flow", () => {
  it("the designer cannot approve their own work", async () => {
    await setStatus("designer", "in_progress");
    await expect(setStatus("designer", "completed")).rejects.toThrow();
  });

  it("the designer moves the due date but not the title", async () => {
    await query(
      "designer",
      "update public.tasks set due_on = current_date + 5 where id = $1",
      [taskId],
    );
    await expect(
      query(
        "designer",
        "update public.tasks set title = 'Mine' where id = $1",
        [taskId],
      ),
    ).rejects.toThrow();
  });

  it("a co-assignee submits; the assigner sends it back once", async () => {
    await setStatus("ssup", "pending_review");
    expect((await task()).submitted_at).not.toBeNull();
    await setStatus("marketing", "revision_required");
    expect(await task()).toMatchObject({
      status: "revision_required",
      revision_count: 1,
    });
  });

  it("the Sales Director sees the task but cannot review it", async () => {
    await setStatus("designer", "pending_review");
    const rows = await setStatus("director", "completed");
    expect(rows).toEqual([]);
    expect((await task()).status).toBe("pending_review");
  });

  it("the MD approves, and a completed task is frozen", async () => {
    await setStatus("md", "completed");
    expect(await task()).toMatchObject({
      status: "completed",
      approved_by: t.profileIds.md,
    });
    await expect(
      query(
        "marketing",
        "update public.tasks set title = 'Again' where id = $1",
        [taskId],
      ),
    ).rejects.toThrow();
  });
});

describe("people who left", () => {
  it("see no tasks, even their own", async () => {
    await t.actAs(null);
    await t.db.query(
      "update public.profiles set active = false where id = $1",
      [t.profileIds.designer],
    );
    expect(await idsIn("designer", "tasks")).toEqual([]);
    expect(await idsIn("designer", "task_log_entries")).toEqual([]);
    expect(await idsIn("designer", "task_files")).toEqual([]);
    await t.actAs(null);
    await t.db.query("update public.profiles set active = true where id = $1", [
      t.profileIds.designer,
    ]);
  });
});
