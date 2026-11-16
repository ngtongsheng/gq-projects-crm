import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { collectLeftover } from "./collect-actions";

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
const LEFTOVER = "66666666-6666-4666-8666-666666666666";

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
  language: "en",
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

/** Records the update payload and the filters the query used. */
function fakeSupabase(result: Result) {
  const seen: { payload?: unknown; filters: string[] } = { filters: [] };
  const query: Record<string, unknown> = {};
  for (const step of ["update", "eq", "in", "select"]) {
    query[step] = (...args: unknown[]) => {
      if (step === "update") seen.payload = args[0];
      if (step === "eq" || step === "in") seen.filters.push(step);
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
  const all = {
    leftoverId: LEFTOVER,
    returnMethod: "transport",
    whatsappSent: "on",
    ...over,
  };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
};

const found = { data: [{ id: LEFTOVER, mof_id: MOF }], error: null };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("collectLeftover", () => {
  it("marks an item collected with how it goes back and the WhatsApp time", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const seen = fakeSupabase(found);

    expect(await collectLeftover(fields())).toEqual({ error: null });
    expect(seen.payload).toMatchObject({
      status: "collected_by_supervisor",
      return_method: "transport",
    });
    expect(seen.payload).toHaveProperty("whatsapp_sent_at");
    // Only an item still waiting or already collected can be collected.
    expect(seen.filters).toEqual(["eq", "in"]);
  });

  it("leaves the WhatsApp time alone when it is not ticked", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const seen = fakeSupabase(found);

    await collectLeftover(fields({ whatsappSent: "" }));

    expect(seen.payload).not.toHaveProperty("whatsapp_sent_at");
  });

  it("needs to know how it goes back", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const seen = fakeSupabase(found);

    expect((await collectLeftover(fields({ returnMethod: "" }))).error).toMatch(
      /how it goes back/,
    );
    expect(seen.payload).toBeUndefined();
  });

  it("refuses other roles", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const seen = fakeSupabase(found);

    expect((await collectLeftover(fields())).error).toMatch(
      /Only a site supervisor/,
    );
    expect(seen.payload).toBeUndefined();
  });

  it("says so when the item has moved on", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ data: [], error: null });

    expect((await collectLeftover(fields())).error).toMatch(
      /no longer waiting for pickup/,
    );
  });
});
