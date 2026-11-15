import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveJob, updateJobStatus } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
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
const SALESPERSON = "55555555-5555-4555-8555-555555555555";
const INSTALLER = "44444444-4444-4444-8444-444444444444";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Wai Mun",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
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
    rpc: vi.fn((name: string, args: unknown) => {
      calls.push({
        table: `rpc:${name}`,
        steps: [],
        payload: args,
        args: [],
      });
      return Promise.resolve(queue.shift() ?? { data: null, error: null });
    }),
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
    team: INSTALLER,
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
  transporter: "Lalamove",
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
      installer_id: INSTALLER,
      supervisor_only: false,
      site_supervisor_id: SUPERVISOR,
      notes: null,
    });
  });

  it("schedules a supervisor-only job with no installer", async () => {
    const calls = fakeSupabase([one(NEW_JOB)]);

    const result = await saveJob(form({ team: "supervisor_only" }));

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toMatchObject({
      installer_id: null,
      supervisor_only: true,
    });
  });

  it("lets the installer be decided later, and a salesperson be in charge", async () => {
    const calls = fakeSupabase([one(NEW_JOB)]);

    await saveJob(form({ team: "", siteSupervisorId: SALESPERSON }));

    expect(calls[0]?.payload).toMatchObject({
      installer_id: null,
      supervisor_only: false,
      site_supervisor_id: SALESPERSON,
    });
  });

  it("refuses a team that is neither an installer nor supervisor only", async () => {
    const calls = fakeSupabase([one(NEW_JOB)]);

    const result = await saveJob(form({ team: "Leong" }));

    expect(result.error).toBe("Choose the installer.");
    expect(calls).toHaveLength(0);
  });

  it("schedules a delivery with its DO and issues the next DO no.", async () => {
    // job added, DO added, number issued
    const calls = fakeSupabase([one(NEW_JOB), one("do"), none]);

    const result = await saveJob(
      form({
        ...deliveryFields,
        isFinal: "on",
        issueNo: "on",
        doDate: "2026-11-11",
        passedToSupplier: "on",
      }),
    );

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.table)).toEqual([
      "jobs",
      "delivery_orders",
      "rpc:issue_do_number",
    ]);
    expect(calls[1]?.payload).toEqual({
      mof_id: MOF,
      job_id: NEW_JOB,
      transporter: "Lalamove",
      delivered_on: null,
      do_date: "2026-11-11",
      is_final: true,
      passed_to_supplier: true,
      signed_returned: false,
    });
    expect(calls[2]?.payload).toEqual({ p_job_id: NEW_JOB });
  });

  it("does not issue a number unless asked", async () => {
    const calls = fakeSupabase([one(NEW_JOB), one("do")]);

    await saveJob(form(deliveryFields));

    expect(calls.map((call) => call.table)).toEqual([
      "jobs",
      "delivery_orders",
    ]);
  });

  it("says so when the delivery was scheduled but the number was not issued", async () => {
    fakeSupabase([
      one(NEW_JOB),
      one("do"),
      { data: null, error: { code: "42501" } },
    ]);

    const result = await saveJob(form({ ...deliveryFields, issueNo: "on" }));

    expect(result.error).toMatch(/scheduled, but its DO no. was not issued/);
  });

  it("says so when the job was added but its DO was not", async () => {
    fakeSupabase([one(NEW_JOB), { data: null, error: { code: "23503" } }]);

    const result = await saveJob(form(deliveryFields));

    expect(result.error).toMatch(
      /scheduled, but its DO details were not saved/,
    );
  });

  it("lets only the MD correct an issued running no.", async () => {
    const asSupport = fakeSupabase([one("do"), one(JOB)]);
    await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "scheduled",
        runningNo: "5563",
      }),
    );
    expect(asSupport[0]?.payload).not.toHaveProperty("running_no");

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    // no clash on the running no., DO updated, job updated
    const asMd = fakeSupabase([none, one("do"), one(JOB)]);
    const result = await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "scheduled",
        runningNo: "5563",
      }),
    );
    expect(result).toEqual({ error: null });
    expect(asMd.map((call) => call.table)).toEqual([
      "delivery_orders",
      "delivery_orders",
      "jobs",
    ]);
    expect(asMd[1]?.payload).toMatchObject({ running_no: "5563" });
  });

  it("refuses a corrected running no. already on another DO", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase([one("other-do")]);

    const result = await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "scheduled",
        runningNo: "5563",
      }),
    );

    expect(result.error).toMatch(/5563 is already used/);
    expect(calls.map((call) => call.table)).toEqual(["delivery_orders"]);
  });

  it("shows a plain message when the corrected running no. cannot be checked", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = fakeSupabase([
      { data: null, error: { code: "08006", message: "connection lost" } },
    ]);

    const result = await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "scheduled",
        runningNo: "5563",
      }),
    );

    expect(result).toEqual({ error: "Could not save the job. Try again." });
    expect(calls.map((call) => call.table)).toEqual(["delivery_orders"]);
    log.mockRestore();
  });

  it("asks for only the 4-digit running number", async () => {
    const calls = fakeSupabase([]);

    const result = await saveJob(
      form({ ...deliveryFields, runningNo: "MOF5" }),
    );

    expect(result.error).toMatch(/4-digit running no/);
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

  it("issues the number, then updates the DO, then the job when editing a delivery", async () => {
    const calls = fakeSupabase([none, one("do"), one(JOB)]);

    const result = await saveJob(
      form({
        ...deliveryFields,
        jobId: JOB,
        status: "done",
        issueNo: "on",
        signedReturned: "on",
      }),
    );

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.table)).toEqual([
      "rpc:issue_do_number",
      "delivery_orders",
      "jobs",
    ]);
    expect(calls[0]?.payload).toEqual({ p_job_id: JOB });
    expect(calls[1]?.payload).toMatchObject({ signed_returned: true });
  });

  it("will not mark a delivery Done without its DO no.", async () => {
    // the DO saves, then the database refuses the job
    fakeSupabase([
      one("do"),
      {
        data: null,
        error: { code: "23514", message: "Key in the Zoho DO no." },
      },
    ]);

    const result = await saveJob(
      form({ ...deliveryFields, jobId: JOB, status: "done" }),
    );

    expect(result.error).toMatch(/Issue the DO no/);
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

    expect(result.error).toMatch(/Issue the DO no/);
  });

  it("rejects an unknown status", async () => {
    const calls = fakeSupabase([]);

    const result = await updateJobStatus(MOF, JOB, "lost" as never);

    expect(result.error).toBe("Choose the status.");
    expect(calls).toHaveLength(0);
  });
});
