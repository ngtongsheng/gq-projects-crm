import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { snoozeFollowUp } from "./follow-up-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("@/lib/work-calendar", () => ({
  loadWorkCalendar: async (week: "mon-fri" | "mon-sat") => ({
    week,
    holidays: new Set(["2026-11-23"]),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const MOF = "33333333-3333-4333-8333-333333333333";
const FOLLOW_UP = "55555555-5555-4555-8555-555555555555";

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

function fakeInsert(error: { code?: string } | null = null) {
  const insert = vi.fn(() => Promise.resolve({ data: null, error }));
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(() => ({ insert })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return insert;
}

const input = (
  changes: Partial<Parameters<typeof snoozeFollowUp>[0]> = {},
) => ({
  mofId: MOF,
  followUpId: FOLLOW_UP,
  ownerGroup: "client",
  assigneeId: null,
  note: " Supplier says Thursday ",
  days: 1,
  ...changes,
});

beforeEach(() => {
  vi.resetAllMocks();
  // Saturday 21 Nov 2026, 10:00 in Malaysia.
  vi.useFakeTimers({ now: new Date("2026-11-21T02:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("snoozeFollowUp", () => {
  it("holds the follow-up until the next working day, skipping Sunday and a holiday", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const insert = fakeInsert();

    const result = await snoozeFollowUp(input());

    // Sunday is off and Monday 23 Nov is a holiday in this test's calendar.
    expect(result).toEqual({ error: null, snoozedUntil: "2026-11-24" });
    expect(insert).toHaveBeenCalledWith({
      follow_up_id: FOLLOW_UP,
      note: "Supplier says Thursday",
      snoozed_until: "2026-11-24",
    });
  });

  it("only offers 1, 2 or 5 working days", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const insert = fakeInsert();

    const result = await snoozeFollowUp(input({ days: 3 }));

    expect(result.error).toMatch(/how long/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("needs a note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const insert = fakeInsert();

    const result = await snoozeFollowUp(input({ note: "   " }));

    expect(result.error).toMatch(/waiting for/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses someone outside the owning group", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const insert = fakeInsert();

    const result = await snoozeFollowUp(input({ ownerGroup: "purchasing" }));

    expect(result.error).toMatch(/group that owns/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("lets the assigned person snooze it", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeInsert();

    const result = await snoozeFollowUp(
      input({ ownerGroup: "purchasing", assigneeId: ME }),
    );

    expect(result.error).toBeNull();
  });

  it("reports a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeInsert({ code: "42501" });

    const result = await snoozeFollowUp(input());

    expect(result.error).toMatch(/group that owns/);
  });
});
