import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { changeProjectStage } from "./change-stage";

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

const PROJECT = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
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

function fakeSupabase(result: { data: unknown; error: unknown }) {
  let payload: unknown;
  const query = {
    update: (value: unknown) => {
      payload = value;
      return query;
    },
    eq: () => query,
    select: () => Promise.resolve(result),
  };
  vi.mocked(createClient).mockResolvedValue({
    from: () => query,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return () => payload;
}

describe("changeProjectStage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  });

  it("moves the project to the chosen stage", async () => {
    const sent = fakeSupabase({ data: [{ id: PROJECT }], error: null });
    const result = await changeProjectStage(PROJECT, "negotiation");
    expect(result.error).toBeNull();
    expect(sent()).toEqual({ stage: "negotiation" });
  });

  it("says so when the database lets no row change", async () => {
    fakeSupabase({ data: [], error: null });
    const result = await changeProjectStage(PROJECT, "awarded");
    expect(result.error).toMatch(/person in charge/);
  });

  it("rejects an unknown stage or project before touching the database", async () => {
    const sent = fakeSupabase({ data: [{ id: PROJECT }], error: null });
    expect((await changeProjectStage(PROJECT, "won")).error).toMatch(/Reload/);
    expect((await changeProjectStage("nope", "lead")).error).toMatch(/Reload/);
    expect(sent()).toBeUndefined();
  });

  it("logs the database error and shows a plain message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeSupabase({ data: null, error: { message: "boom" } });
    const result = await changeProjectStage(PROJECT, "lead");
    expect(result.error).toBe("Could not change the stage. Try again.");
  });
});
