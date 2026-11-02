import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveJob, updateJobStatus } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const MOF = "33333333-3333-4333-8333-333333333333";
const JOB = "66666666-6666-4666-8666-666666666666";
const NEW_JOB = "77777777-7777-4777-8777-777777777777";
const SUPERVISOR = "88888888-8888-4888-8888-888888888888";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Wai Mun",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = {
  table: string;
  steps: string[];
  payload: unknown;
  args: unknown[];
};

/** Each query takes the next result in line; calls are recorded in order. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined, args: [] };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "neq", "select"]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
          call.args.push(...args);
          if (step === "insert" || step === "update") call.payload = args[0];
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

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    mofId: MOF,
    jobType: "installation",
    scheduledOn: "2026-11-10",
    endsOn: "2026-11-12",
    startTime: "08:30",
    installer: " Leong ",
    siteSupervisorId: SUPERVISOR,
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const deliveryFields = {
  jobType: "delivery",
  runningNo: "5563",
  transporter: "Lalamove",
  items: "Carpet tile 1,200 m2",
};

const none: Result = { data: [], error: null };
const one = (id: string): Result => ({ data: [{ id }], error: null });

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("saveJob", () => {
  it("schedules a new job as Scheduled", async () => {
    const calls = fakeSupabase([one(NEW_JOB)]);

    const result = await saveJob(form());

    expect(result).toEqual({ error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("jobs");
    expect(calls[0]?.payload).toEqual({
      mof_id: MOF,
      job_type: "installation",
      status: "scheduled",
      scheduled_on: "2026-11-10",
      ends_on: "2026-11-12",
      start_time: "08:30",
      installer: "Leong",
      site_supervisor_id: SUPERVISOR,
      notes: null,
    });
  });

  it("schedules a delivery with its DO", async () => {
    // no clash on the running no., job added, DO added
    const calls = fakeSupabase([none, one(NEW_JOB), one("do")]);

    const result = await saveJob(form({ ...deliveryFields, isFinal: "on" }));

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.table)).toEqual([
      "delivery_orders",
      "jobs",
      "delivery_orders",
    ]);
    expect(calls[2]?.payload).toEqual({
      mof_id: MOF,
      job_id: NEW_JOB,
      running_no: "5563",
      transporter: "Lalamove",
      delivered_on: null,
      items: "Carpet tile 1,200 m2",
      is_final: true,
      signed_returned: false,
    });
  });

  it("refuses a running no. already on another DO before adding the job", async () => {
    const calls = fakeSupabase([one("other-do")]);

    const result = await saveJob(form(deliveryFields));

    expect(result.error).toMatch(/5563 is already used/);
    expect(calls.map((call) => call.table)).toEqual(["delivery_orders"]);
  });

  it("says so when the job was added but its DO was not", async () => {
    fakeSupabase([
      none,
      one(NEW_JOB),
      { data: null, error: { code: "23505" } },
    ]);

    const result = await saveJob(form(deliveryFields));

    expect(result.error).toMatch(
      /scheduled, but its DO details were not saved/,
    );
  });

  it("asks for only the 4-digit running number", async () => {
    const calls = fakeSupabase([]);

    const result = await saveJob(
      form({ ...deliveryFields, runningNo: "MOF5" }),
    );

    expect(result.error).toMatch(/4-digit Zoho running no/);
    expect(calls).toHaveLength(0);
  });

  it("changes a job without moving it to another MOF or type", async () => {
    const calls = fakeSupabase([one(JOB)]);

    const result = await saveJob(form({ jobId: JOB, status: "in_progress" }));

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toMatchObject({ status: "in_progress" });
    expect(calls[0]?.payload).not.toHaveProperty("mof_id");
    expect(calls[0]?.payload).not.toHaveProperty("job_type");
    expect(calls[0]?.args).toEqual(
      expect.arrayContaining([
        "id",
        JOB,
        "mof_id",
        MOF,
        "job_type",
        "installation",
      ]),
    );
  });

  it("updates the DO before the job when editing a delivery", async () => {
    const calls = fakeSupabase([none, one("do"), one(JOB)]);

    const result = await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "done",
        signedReturned: "on",
      }),
    );

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.table)).toEqual([
      "delivery_orders",
      "delivery_orders",
      "jobs",
    ]);
    expect(calls[1]?.payload).toMatchObject({ signed_returned: true });
  });

  it("will not mark a delivery Done without its DO no.", async () => {
    const calls = fakeSupabase([]);

    const result = await saveJob(
      form({ ...deliveryFields, jobId: JOB, status: "done", runningNo: "" }),
    );

    expect(result.error).toMatch(/Key in the Zoho DO no/);
    expect(calls).toHaveLength(0);
  });

  it("rejects an end date before the start date", async () => {
    const calls = fakeSupabase([]);

    const result = await saveJob(form({ endsOn: "2026-11-09" }));

    expect(result.error).toBe("The end date cannot be before the start date.");
    expect(calls).toHaveLength(0);
  });

  it("refuses someone who cannot schedule jobs", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveJob(form());

    expect(result.error).toMatch(/Only the MD, Sales Director or Purchasing/);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal from the database", async () => {
    fakeSupabase([{ data: null, error: { code: "42501" } }]);

    const result = await saveJob(form());

    expect(result.error).toMatch(/Only the MD, Sales Director or Purchasing/);
  });

  it("reports a job that is gone", async () => {
    fakeSupabase([none]);

    const result = await saveJob(form({ jobId: JOB, status: "scheduled" }));

    expect(result.error).toMatch(/Reload the page/);
  });
});

describe("updateJobStatus", () => {
  it("lets a Site Supervisor move a job along", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase([one(JOB)]);

    const result = await updateJobStatus(MOF, JOB, "done");

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({ status: "done" });
  });

  it("refuses roles that do not work jobs", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await updateJobStatus(MOF, JOB, "done");

    expect(result.error).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("does not find a job assigned to someone else", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase([none]);

    const result = await updateJobStatus(MOF, JOB, "done");

    expect(result.error).toMatch(/not assigned to you/);
  });

  it("explains a delivery that cannot be Done yet", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase([
      {
        data: null,
        error: { code: "23514", message: "Key in the Zoho DO no." },
      },
    ]);

    const result = await updateJobStatus(MOF, JOB, "done");

    expect(result.error).toMatch(/Key in the Zoho DO no/);
  });

  it("rejects an unknown status", async () => {
    const calls = fakeSupabase([]);

    const result = await updateJobStatus(MOF, JOB, "lost" as never);

    expect(result.error).toBe("Choose the status.");
    expect(calls).toHaveLength(0);
  });
});
