import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { DEFAULT_COMMISSION_SETTINGS } from "@/lib/domain/commission-settings";
import { createClient } from "@/lib/supabase/server";
import { saveCommissionSettings } from "./actions";

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

const profile = (
  jobRole: Profile["jobRole"],
  overrides: Partial<Profile> = {},
): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Vicky",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
  ...overrides,
});

type Upsert = { rows: unknown };

function fakeSupabase(error: { code?: string; message?: string } | null) {
  const upserts: Upsert[] = [];
  const client = {
    from: vi.fn(() => ({
      upsert: (rows: unknown) => {
        upserts.push({ rows });
        return Promise.resolve({ data: null, error });
      },
    })),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return upserts;
}

const fields = (change: Record<string, string> = {}) => {
  const data = new FormData();
  const values: Record<string, string> = {
    baseOwn: "3",
    basePassDown: "1.5",
    baseCompany: "1.5",
    noCommissionBelow: "20",
    lowMarginBelow: "30",
    lowOwn: "1.5",
    lowOther: "1",
    highMarginAbove: "45",
    highMarginBonus: "1",
    firstCutDays: "90",
    firstCutPct: "25",
    secondCutDays: "120",
    secondCutPct: "50",
    claimThreshold: "90",
    splitShare: "50",
    flatPassDown: "1",
    ...change,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeEach(() => vi.clearAllMocks());

describe("saveCommissionSettings", () => {
  it("lets the MD and an admin save the rules and the claim threshold", async () => {
    for (const me of [profile("md"), profile("sales", { role: "admin" })]) {
      vi.mocked(getCurrentProfile).mockResolvedValue(me);
      const upserts = fakeSupabase(null);

      const result = await saveCommissionSettings(
        fields({ claimThreshold: "95" }),
      );

      expect(result).toEqual({ error: null });
      const { claimThresholdPct: _, ...rules } = DEFAULT_COMMISSION_SETTINGS;
      expect(upserts[0]?.rows).toEqual([
        { key: "commission", value: rules },
        { key: "payment_threshold_pct", value: 95 },
      ]);
    }
  });

  it("refuses everyone else", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const upserts = fakeSupabase(null);
    expect((await saveCommissionSettings(fields())).error).toMatch(
      /Only the MD or an admin/,
    );
    expect(upserts).toHaveLength(0);
  });

  it("explains a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ code: "42501" });
    expect((await saveCommissionSettings(fields())).error).toMatch(
      /Only the MD or an admin/,
    );
  });

  it("rejects blank and inconsistent values without saving", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const upserts = fakeSupabase(null);
    expect(
      (await saveCommissionSettings(fields({ baseOwn: "" }))).error,
    ).toMatch(/own effort rate as a number/);
    expect(
      (await saveCommissionSettings(fields({ secondCutDays: "60" }))).error,
    ).toBe("The second cut must start after the first.");
    expect(upserts).toHaveLength(0);
  });
});
