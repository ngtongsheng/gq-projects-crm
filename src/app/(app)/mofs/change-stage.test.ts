import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { changeMofStage } from "./change-stage";

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

const MOF = "55555555-5555-4555-8555-555555555555";

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

type Current = { stage: string; payment_checked: boolean } | null;

function fakeSupabase(
  current: Current,
  updated: { id: string }[] = [{ id: MOF }],
) {
  let payload: unknown;
  const query = {
    select: (columns: string) =>
      columns === "id"
        ? Promise.resolve({ data: updated, error: null })
        : query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: current, error: null }),
    update: (value: unknown) => {
      payload = value;
      return query;
    },
  };
  vi.mocked(createClient).mockResolvedValue({
    from: () => query,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return () => payload;
}

describe("changeMofStage", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
  });

  it("moves the MOF to the chosen stage", async () => {
    const sent = fakeSupabase({ stage: "ordered", payment_checked: false });
    const result = await changeMofStage(MOF, "in_production");
    expect(result).toEqual({ error: null });
    expect(sent()).toEqual({ stage: "in_production" });
  });

  it("warns, but still moves, when payment was not checked before delivery", async () => {
    const sent = fakeSupabase({
      stage: "pending_delivery",
      payment_checked: false,
    });
    const result = await changeMofStage(MOF, "delivered_installing");
    expect(result.error).toBeNull();
    expect(result.warning).toMatch(/Payment status was not checked/);
    expect(sent()).toEqual({ stage: "delivered_installing" });
  });

  it("does not move a closed MOF", async () => {
    const sent = fakeSupabase({ stage: "closed", payment_checked: true });
    const result = await changeMofStage(MOF, "ordered");
    expect(result.error).toMatch(/can't move/);
    expect(sent()).toBeUndefined();
  });

  it("refuses anyone who does not keep the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const sent = fakeSupabase({ stage: "ordered", payment_checked: false });
    const result = await changeMofStage(MOF, "shipping");
    expect(result.error).toMatch(/Only the MD/);
    expect(sent()).toBeUndefined();
  });

  it("says so when the database lets no row change", async () => {
    fakeSupabase({ stage: "ordered", payment_checked: false }, []);
    const result = await changeMofStage(MOF, "shipping");
    expect(result.error).toMatch(/Only the MD/);
  });

  it("rejects an unknown stage or MOF before touching the database", async () => {
    const sent = fakeSupabase({ stage: "ordered", payment_checked: false });
    expect((await changeMofStage(MOF, "won")).error).toMatch(/Reload/);
    expect((await changeMofStage("nope", "shipping")).error).toMatch(/Reload/);
    expect(sent()).toBeUndefined();
  });
});
