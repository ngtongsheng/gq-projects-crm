import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addReferenceFile,
  openTaskFile,
  requestTaskUpload,
} from "./task-file-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ASSIGNER = "11111111-1111-4111-8111-111111111111";
const MAIN = "22222222-2222-4222-8222-222222222222";
const TASK = "55555555-5555-4555-8555-555555555555";
const FILE = "77777777-7777-4777-8777-777777777777";

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
type Call = { table: string; op: string; payload: unknown };

/** Each query takes the next result in line; storage signs every path it is asked for. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const signed: string[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, op: "select", payload: undefined };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      query.insert = (payload: unknown) => {
        call.op = "insert";
        call.payload = payload;
        return Promise.resolve(result);
      };
      for (const step of ["select", "eq"]) query[step] = () => query;
      query.maybeSingle = () => Promise.resolve(result);
      return query;
    }),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => {
          signed.push(path);
          return { data: { token: "tok", path }, error: null };
        },
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { calls, signed };
}

const task = (status: string) => ({
  data: {
    id: TASK,
    status,
    assignee_id: MAIN,
    assigned_by: ASSIGNER,
    priority: "normal",
    due_on: "2026-12-01",
    task_co_assignees: [],
  },
  error: null,
});

const pdf = {
  fileName: "Brief.pdf",
  contentType: "application/pdf",
  size: 5000,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("requestTaskUpload", () => {
  it("signs a path under the task for the person doing the work", async () => {
    signedIn(MAIN, "designer");
    const { signed } = fakeSupabase(task("in_progress"));

    const result = await requestTaskUpload(TASK, "work", pdf);

    expect(result.error).toBeNull();
    expect(signed[0]).toMatch(
      new RegExp(`^tasks/${TASK}/[0-9a-f]{8}-brief.pdf$`),
    );
  });

  it("lets only the assigner add reference files and only the workers add work", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(task("in_progress"));
    expect((await requestTaskUpload(TASK, "reference", pdf)).error).toMatch(
      /cannot do that/,
    );

    signedIn(ASSIGNER, "bd");
    fakeSupabase(task("in_progress"));
    expect((await requestTaskUpload(TASK, "work", pdf)).error).toMatch(
      /cannot do that/,
    );

    signedIn(ASSIGNER, "bd");
    fakeSupabase(task("in_progress"));
    expect((await requestTaskUpload(TASK, "reference", pdf)).error).toBeNull();
  });

  it("refuses work once the task is waiting for review", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(task("pending_review"));
    expect((await requestTaskUpload(TASK, "work", pdf)).error).toMatch(
      /cannot do that/,
    );
  });

  it("refuses a file type the bucket does not take", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(task("in_progress"));
    const result = await requestTaskUpload(TASK, "work", {
      ...pdf,
      contentType: "application/zip",
    });
    expect(result.error).toMatch(/photo/);
  });
});

describe("addReferenceFile", () => {
  const file = {
    path: `tasks/${TASK}/1a2b3c4d-brief.pdf`,
    fileName: "Brief.pdf",
    contentType: "application/pdf",
  };

  it("records the file as a reference for the assigner", async () => {
    signedIn(ASSIGNER, "bd");
    const { calls } = fakeSupabase(task("not_started"), {
      data: null,
      error: null,
    });

    expect(await addReferenceFile(TASK, file)).toEqual({ error: null });
    expect(calls[1]).toMatchObject({
      table: "task_files",
      payload: {
        task_id: TASK,
        path: file.path,
        file_name: "Brief.pdf",
        kind: "reference",
      },
    });
  });

  it("refuses everyone else and a path outside the task folder", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase(task("not_started"));
    expect((await addReferenceFile(TASK, file)).error).toMatch(
      /cannot do that/,
    );

    signedIn(ASSIGNER, "bd");
    const { calls } = fakeSupabase();
    const stray = {
      ...file,
      path: "tasks/66666666-6666-4666-8666-666666666666/1a2b3c4d-brief.pdf",
    };
    expect((await addReferenceFile(TASK, stray)).error).toMatch(
      /could not be read/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("openTaskFile", () => {
  it("gives a short-lived link for a file the person can see", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase({
      data: { path: `tasks/${TASK}/1a2b3c4d-brief.pdf` },
      error: null,
    });
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://files.example/brief" },
      error: null,
    }));
    vi.mocked(createAdminClient).mockReturnValue({
      storage: { from: () => ({ createSignedUrl }) },
    } as unknown as ReturnType<typeof createAdminClient>);

    expect(await openTaskFile(FILE)).toEqual({
      error: null,
      url: "https://files.example/brief",
    });
    expect(createSignedUrl).toHaveBeenCalledWith(
      `tasks/${TASK}/1a2b3c4d-brief.pdf`,
      300,
    );
  });

  it("says the file is not available when row-level security hides it", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase({ data: null, error: null });
    expect((await openTaskFile(FILE)).error).toMatch(/not available/);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("says files open on the preview link when there is no service key", async () => {
    signedIn(MAIN, "designer");
    fakeSupabase({
      data: { path: `tasks/${TASK}/1a2b3c4d-brief.pdf` },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(null);
    expect((await openTaskFile(FILE)).error).toMatch(/preview link/);
  });
});
