import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { answerInvitation, inviteColleagues } from "./invitation-actions";

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
const SITI = "33333333-3333-4333-8333-333333333333";
const ACTIVITY = "55555555-5555-4555-8555-555555555555";

const profile: Profile = {
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole: "sales",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
};

type Result = { data: unknown; error: { code?: string } | null };
type Call = {
  table: string;
  payload: unknown;
  filters: [string, unknown][];
};

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, payload: undefined, filters: [] };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["select", "insert", "update", "eq", "maybeSingle"]) {
        query[step] = (...args: unknown[]) => {
          if (step === "insert" || step === "update") call.payload = args[0];
          if (step === "eq") call.filters.push([String(args[0]), args[1]]);
          if (step === "maybeSingle") return Promise.resolve(result);
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

describe("answerInvitation", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile);
  });

  it("answers only the signed-in person's own invitation", async () => {
    const calls = fakeSupabase([
      { data: [{ activity_id: ACTIVITY }], error: null },
    ]);

    const result = await answerInvitation(ACTIVITY, "accepted");

    expect(result.error).toBeNull();
    expect(calls[0]?.table).toBe("activity_invitees");
    expect(calls[0]?.payload).toEqual({ status: "accepted" });
    expect(calls[0]?.filters).toEqual([
      ["activity_id", ACTIVITY],
      ["profile_id", ME],
    ]);
  });

  it("refuses when the person has no invitation to answer", async () => {
    fakeSupabase([{ data: [], error: null }]);

    const result = await answerInvitation(ACTIVITY, "declined");

    expect(result.error).toMatch(/no invitation/);
  });

  it("refuses an answer other than accept or decline before touching the database", async () => {
    const calls = fakeSupabase([]);

    // @ts-expect-error a client can post anything
    const result = await answerInvitation(ACTIVITY, "pending");

    expect(result.error).toMatch(/accept or can't go/);
    expect(calls).toHaveLength(0);
  });

  it("turns a database refusal into a plain message", async () => {
    fakeSupabase([{ data: null, error: { code: "42501" } }]);

    const result = await answerInvitation(ACTIVITY, "accepted");

    expect(result.error).toMatch(/Try again/);
  });
});

describe("inviteColleagues", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile);
  });

  it("invites each colleague once, waiting for their answer, on a planned activity", async () => {
    const calls = fakeSupabase([
      { data: { status: "planned" }, error: null },
      { data: null, error: null },
    ]);

    const result = await inviteColleagues(ACTIVITY, [ARUN, SITI, ARUN]);

    expect(result.error).toBeNull();
    expect(calls[1]?.table).toBe("activity_invitees");
    expect(calls[1]?.payload).toEqual([
      { activity_id: ACTIVITY, profile_id: ARUN, status: "pending" },
      { activity_id: ACTIVITY, profile_id: SITI, status: "pending" },
    ]);
  });

  it("counts colleagues as having gone on a visit already recorded as done", async () => {
    const calls = fakeSupabase([
      { data: { status: "completed" }, error: null },
      { data: null, error: null },
    ]);

    await inviteColleagues(ACTIVITY, [ARUN]);

    expect(calls[1]?.payload).toEqual([
      { activity_id: ACTIVITY, profile_id: ARUN, status: "accepted" },
    ]);
  });

  it("reports an activity that cannot be found", async () => {
    fakeSupabase([{ data: null, error: null }]);

    const result = await inviteColleagues(ACTIVITY, [ARUN]);

    expect(result.error).toMatch(/Could not find/);
  });
});
