import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { decideOtClaim, submitOtClaim } from "./actions";

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
const MOF = "33333333-3333-4333-8333-333333333333";
const CLAIM = "66666666-6666-4666-8666-666666666666";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Awal",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { name: string; payload: unknown };

/** Each query takes the next result in line; calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const next = () => queue.shift() ?? { data: [], error: null };
  const client = {
    rpc: vi.fn((name: string, args: unknown) => {
      calls.push({ name, payload: args });
      return Promise.resolve(next());
    }),
    from: vi.fn((table: string) => {
      const call: Call = { name: table, payload: undefined };
      calls.push(call);
      const result = next();
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
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

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const claimForm = (fields: Record<string, string> = {}) =>
  form({
    workDate: "2026-11-01",
    mofId: MOF,
    reason: " Night shift installation ",
    fromTime: "22:00",
    toTime: "02:00",
    claimAs: "ot",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("submitOtClaim", () => {
  it("saves a claim without sending who filed it or the hours", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await submitOtClaim(claimForm());

    expect(result).toEqual({ error: null });
    expect(calls[0]).toEqual({
      name: "ot_claims",
      payload: {
        work_date: "2026-11-01",
        from_time: "22:00",
        to_time: "02:00",
        mof_id: MOF,
        reason: "Night shift installation",
        claim_as: "ot",
      },
    });
  });

  it("asks for a reason", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    const result = await submitOtClaim(claimForm({ reason: "   " }));

    expect(result.error).toMatch(/reason/);
    expect(calls).toHaveLength(0);
  });

  it("refuses identical or too-short spans", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    const same = await submitOtClaim(claimForm({ toTime: "22:00" }));
    const short = await submitOtClaim(claimForm({ toTime: "22:10" }));

    expect(same.error).toMatch(/same/);
    expect(short.error).toMatch(/under 15 minutes/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a day that has not come", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    const result = await submitOtClaim(claimForm({ workDate: "2999-01-01" }));

    expect(result.error).toMatch(/not come/);
    expect(calls).toHaveLength(0);
  });

  it("rejects an unknown claim type", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase();

    const result = await submitOtClaim(claimForm({ claimAs: "cash" }));

    expect(result.error).toMatch(/how you want to claim/);
  });
});

describe("decideOtClaim", () => {
  it("lets the MD and Sales Director approve as a chosen type", async () => {
    for (const role of ["md", "director"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase({ data: [{ id: CLAIM }], error: null });

      const result = await decideOtClaim(CLAIM, "replacement_leave");

      expect(result).toEqual({ error: null });
      expect(calls[0]).toEqual({
        name: "ot_claims",
        payload: { status: "approved", approved_as: "replacement_leave" },
      });
    }
  });

  it("rejects without an approved type", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({ data: [{ id: CLAIM }], error: null });

    await decideOtClaim(CLAIM, "reject");

    expect(calls[0]?.payload).toEqual({
      status: "rejected",
      approved_as: null,
    });
  });

  it("refuses every other role before touching the database", async () => {
    // Purchasing has no Claims page in the demo, so the page check stops them first.
    for (const role of ["bd", "sales", "accounts", "site"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await decideOtClaim(CLAIM, "ot");

      expect(result.error).toMatch(/Only the MD or Sales Director/);
      expect(calls).toHaveLength(0);
    }
  });

  it("rejects an unknown decision", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase();

    const result = await decideOtClaim(CLAIM, "maybe");

    expect(result.error).toMatch(/approve or reject/);
    expect(calls).toHaveLength(0);
  });

  it("explains when the database hides the claim (decided already, or your own)", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: [], error: null });

    const result = await decideOtClaim(CLAIM, "ot");

    expect(result.error).toMatch(/already decided/);
  });
});
