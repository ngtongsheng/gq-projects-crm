import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveUnijoyTarget } from "./unijoy-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const profile = (
  role: Profile["role"],
  jobRole: Profile["jobRole"],
): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Tester",
  role,
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

function fakeSupabase(
  existing: unknown,
  upsertError: { code: string } | null = null,
) {
  const upsert = vi.fn(async () => ({ error: upsertError }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: existing === undefined ? null : { value: existing },
            error: null,
          }),
        }),
      }),
      upsert,
    })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return upsert;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("saveUnijoyTarget", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("saves the target for a year and keeps the other years", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff", "md"));
    const upsert = fakeSupabase({ "2026": 25000 });

    const result = await saveUnijoyTarget(
      form({ year: "2027", target: "30,000" }),
    );

    expect(result).toEqual({ error: null });
    expect(upsert).toHaveBeenCalledWith(
      [{ key: "unijoy_target_m2", value: { "2026": 25000, "2027": 30000 } }],
      { onConflict: "key" },
    );
  });

  it("changes the target of a year that already has one", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("admin", "sales"));
    const upsert = fakeSupabase({ "2026": 25000 });

    await saveUnijoyTarget(form({ year: "2026", target: "26000" }));

    expect(upsert).toHaveBeenCalledWith(
      [{ key: "unijoy_target_m2", value: { "2026": 26000 } }],
      { onConflict: "key" },
    );
  });

  it("starts the setting when there is none", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff", "md"));
    const upsert = fakeSupabase(undefined);

    await saveUnijoyTarget(form({ year: "2026", target: "25000" }));

    expect(upsert).toHaveBeenCalledWith(
      [{ key: "unijoy_target_m2", value: { "2026": 25000 } }],
      { onConflict: "key" },
    );
  });

  it("is for the MD or an admin only", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(
      profile("staff", "director"),
    );
    const upsert = fakeSupabase({});

    const result = await saveUnijoyTarget(
      form({ year: "2026", target: "25000" }),
    );

    expect(result.error).toMatch(/Only the MD or an admin/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["", "The target must be more than zero."],
    ["0", "The target must be more than zero."],
    ["-5", "The target must be more than zero."],
    ["lots", "Enter the target in m²."],
  ])("refuses the target %j", async (target, message) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff", "md"));
    const upsert = fakeSupabase({});

    const result = await saveUnijoyTarget(form({ year: "2026", target }));

    expect(result.error).toBe(message);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses a year that is not a year", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff", "md"));
    fakeSupabase({});

    const result = await saveUnijoyTarget(
      form({ year: "26", target: "25000" }),
    );

    expect(result.error).toBe("Choose the year.");
  });

  it("explains when the database refuses", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("staff", "md"));
    fakeSupabase({}, { code: "42501" });

    const result = await saveUnijoyTarget(
      form({ year: "2026", target: "25000" }),
    );

    expect(result.error).toMatch(/Only the MD or an admin/);
  });
});
