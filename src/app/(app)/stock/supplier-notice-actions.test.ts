import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { markSupplierNoticesSent } from "./supplier-notice-actions";

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

const LINE = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
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

type Update = { payload: unknown; filters: unknown[][] };

function fakeSupabase(
  error: { code?: string; message?: string } | null = null,
) {
  const updates: Update[] = [];
  const client = {
    from: vi.fn(() => {
      const update: Update = { payload: undefined, filters: [] };
      updates.push(update);
      const query: Record<string, unknown> = {};
      query.update = (payload: unknown) => {
        update.payload = payload;
        return query;
      };
      for (const step of ["eq", "is"]) {
        query[step] = (...args: unknown[]) => {
          update.filters.push([step, ...args]);
          return Object.assign(Promise.resolve({ error }), query);
        };
      }
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return updates;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("markSupplierNoticesSent", () => {
  it("marks only the notice the email carried, and only while unsent", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const updates = fakeSupabase();

    const result = await markSupplierNoticesSent([
      { id: LINE, notice: "extend" },
    ]);

    expect(result).toEqual({ error: null });
    expect(updates).toHaveLength(1);
    expect(updates[0].filters).toEqual([
      ["eq", "id", LINE],
      ["eq", "supplier_notice", "extend"],
      ["is", "supplier_notified_at", null],
    ]);
    expect(updates[0].payload).toHaveProperty("supplier_notified_at");
  });

  it("refuses people who do not arrange stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const updates = fakeSupabase();

    const result = await markSupplierNoticesSent([
      { id: LINE, notice: "reserve" },
    ]);

    expect(result.error).toMatch(/arrange stock/);
    expect(updates).toHaveLength(0);
  });

  it("refuses an empty or malformed list", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase();

    expect((await markSupplierNoticesSent([])).error).toBe(
      "Nothing to mark as sent.",
    );
    expect(
      (await markSupplierNoticesSent([{ id: "x", notice: "reserve" }])).error,
    ).toMatch(/Reload/);
  });
});
