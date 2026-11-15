import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { arrangeLeftoverTransport } from "./transport-actions";

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
const FIRST = "66666666-6666-4666-8666-666666666666";
const SECOND = "77777777-7777-4777-8777-777777777777";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Jess",
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

function fakeSupabase(result: Result) {
  const seen: { payload?: unknown; ids?: unknown } = {};
  const query: Record<string, unknown> = {};
  for (const step of ["update", "in", "eq", "is", "select"]) {
    query[step] = (...args: unknown[]) => {
      if (step === "update") seen.payload = args[0];
      if (step === "in") seen.ids = args[1];
      return Object.assign(Promise.resolve(result), query);
    };
  }
  vi.mocked(createClient).mockResolvedValue({
    from: () => query,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return seen;
}

const fields = (over: Record<string, string> = {}) => {
  const data = new FormData();
  data.append("leftoverId", FIRST);
  data.append("leftoverId", SECOND);
  const all = {
    transportBy: "Lalamove",
    transportOn: "2026-11-20",
    transportTo: "Best Link",
    transportCost: "45.50",
    ...over,
  };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
};

const found = {
  data: [
    { id: FIRST, mof_id: MOF },
    { id: SECOND, mof_id: MOF },
  ],
  error: null,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("arrangeLeftoverTransport", () => {
  it("names the transport for every item of the site", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const seen = fakeSupabase(found);

    expect(await arrangeLeftoverTransport(fields())).toEqual({ error: null });
    expect(seen.ids).toEqual([FIRST, SECOND]);
    expect(seen.payload).toEqual({
      transport_by: "Lalamove",
      transport_on: "2026-11-20",
      transport_to: "Best Link",
      transport_cost: 45.5,
    });
  });

  it("needs who takes it and the pickup date", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const seen = fakeSupabase(found);

    expect(
      (await arrangeLeftoverTransport(fields({ transportBy: "" }))).error,
    ).toMatch(/Choose who takes it/);
    expect(
      (await arrangeLeftoverTransport(fields({ transportOn: "" }))).error,
    ).toMatch(/pickup date/);
    expect(
      (await arrangeLeftoverTransport(fields({ transportCost: "abc" }))).error,
    ).toMatch(/transport cost/);
    expect(seen.payload).toBeUndefined();
  });

  it("refuses people who do not arrange stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const seen = fakeSupabase(found);

    expect((await arrangeLeftoverTransport(fields())).error).toMatch(
      /Only the people who arrange stock/,
    );
    expect(seen.payload).toBeUndefined();
  });

  it("says so when nothing is waiting for transport any more", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase({ data: [], error: null });

    expect((await arrangeLeftoverTransport(fields())).error).toMatch(
      /Could not find those items/,
    );
  });
});
