import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { logOutcome } from "./log-outcome-action";

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

const ME = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";
const CONTACT = "44444444-4444-4444-8444-444444444444";
const ACTIVITY = "55555555-5555-4555-8555-555555555555";
const PROJECT = "66666666-6666-4666-8666-666666666666";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
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
type Call = { table: string; steps: string[]; payload: unknown };

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "eq",
        "maybeSingle",
        "single",
      ]) {
        query[step] = (payload?: unknown) => {
          call.steps.push(step);
          if (step === "insert" || step === "update") call.payload = payload;
          if (step === "maybeSingle" || step === "single") {
            return Promise.resolve(result);
          }
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
    activityId: ACTIVITY,
    result: "quotation_requested",
    learnings: "Joyce decides. Two offices in Q1, about 3,000 m2.",
    leadName: "",
    leadValue: "",
    leadStart: "",
    nextStep: "",
    nextDate: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const visit = (ownerId = ME, status = "planned"): Result => ({
  data: {
    owner_id: ownerId,
    contact_id: CONTACT,
    status,
    starts_at: "2026-11-10T02:00:00Z",
  },
  error: null,
});
const logged = (late: boolean): Result => ({
  data: [{ late_logged: late }],
  error: null,
});
const customer = (owners: string[]): Result => ({
  data: {
    account_type: "own",
    passed_by: null,
    contact_owners: owners.map((profile_id) => ({ profile_id })),
  },
  error: null,
});
const ok: Result = { data: null, error: null };

describe("logOutcome", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  });

  it("completes the visit with result and learnings, sending no lateness", async () => {
    const calls = fakeSupabase([visit(), logged(false)]);

    const result = await logOutcome(form());

    expect(result).toEqual({ error: null, late: false });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.payload).toEqual({
      status: "completed",
      result: "quotation_requested",
      outcome: "Joyce decides. Two offices in Q1, about 3,000 m2.",
      lead_project_id: null,
    });
  });

  it("reports the late flag the database stamped past the deadline", async () => {
    fakeSupabase([visit(), logged(true)]);

    const result = await logOutcome(form());

    expect(result).toEqual({ error: null, late: true });
  });

  it("refuses learnings under 15 characters before touching the database", async () => {
    const calls = fakeSupabase([]);

    const result = await logOutcome(form({ learnings: "Met Joyce." }));

    expect(result.error).toMatch(/what you learned/);
    expect(calls).toHaveLength(0);
  });

  it("plans the follow-up visit at 10:00 Malaysia time under the person logging", async () => {
    const calls = fakeSupabase([visit(), logged(false), ok]);

    const result = await logOutcome(
      form({ nextStep: "Send quotation", nextDate: "2026-11-20" }),
    );

    expect(result.error).toBeNull();
    expect(calls[2]?.table).toBe("activities");
    expect(calls[2]?.payload).toEqual({
      contact_id: CONTACT,
      owner_id: ME,
      type: "visit",
      purpose: "Send quotation",
      starts_at: "2026-11-20T02:00:00.000Z",
      status: "planned",
    });
  });

  it("adds a project lead and links it to the visit", async () => {
    const calls = fakeSupabase([
      visit(),
      customer([ME]),
      { data: { id: PROJECT }, error: null },
      logged(false),
    ]);

    const result = await logOutcome(
      form({
        leadName: "Menara ABC L12 office",
        leadValue: "45000",
        leadStart: "2027-01",
      }),
    );

    expect(result.error).toBeNull();
    expect(calls[2]?.table).toBe("projects");
    expect(calls[2]?.payload).toMatchObject({
      contact_id: CONTACT,
      name: "Menara ABC L12 office",
      stage: "lead",
      value: 45000,
      pic_id: ME,
      notes: "Expected start: Jan 2027",
    });
    expect(calls[3]?.payload).toMatchObject({ lead_project_id: PROJECT });
  });

  it("refuses a lead for a customer the salesperson does not own", async () => {
    const calls = fakeSupabase([visit(), customer([ARUN])]);

    const result = await logOutcome(form({ leadName: "Menara ABC L12" }));

    expect(result.error).toMatch(/owners/);
    expect(calls).toHaveLength(2);
  });

  it("refuses an activity already completed", async () => {
    const calls = fakeSupabase([visit(ME, "completed")]);

    const result = await logOutcome(form());

    expect(result.error).toMatch(/already completed/);
    expect(calls).toHaveLength(1);
  });

  it("refuses someone else's visit for a salesperson", async () => {
    fakeSupabase([visit(ARUN)]);

    const result = await logOutcome(form());

    expect(result.error).toMatch(/owns this activity/);
  });
});
