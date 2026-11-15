import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { allocateLeftover } from "./allocation-actions";

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
const PROJECT = "44444444-4444-4444-8444-444444444444";
const LEFTOVER = "66666666-6666-4666-8666-666666666666";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Sarah",
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

function fakeSupabase(result: Result = { data: null, error: null }) {
  const inserts: { table: string; row: unknown }[] = [];
  vi.mocked(createClient).mockResolvedValue({
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserts.push({ table, row });
        return Promise.resolve(result);
      },
    }),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return inserts;
}

const fields = (over: Record<string, string> = {}) => {
  const data = new FormData();
  const all = {
    leftoverId: LEFTOVER,
    projectId: PROJECT,
    qty: "4",
    usedOn: "2026-11-15",
    note: " Sold at RM 18 per box ",
    ...over,
  };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("allocateLeftover", () => {
  it("saves a use for another project", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const inserts = fakeSupabase();

    expect(await allocateLeftover(fields())).toEqual({ error: null });
    expect(inserts).toEqual([
      {
        table: "leftover_allocations",
        row: {
          leftover_id: LEFTOVER,
          project_id: PROJECT,
          qty: 4,
          allocated_on: "2026-11-15",
          note: "Sold at RM 18 per box",
        },
      },
    ]);
  });

  it("refuses people who do not arrange stock, before touching the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
    const inserts = fakeSupabase();

    expect((await allocateLeftover(fields())).error).toMatch(
      /Only the people who arrange stock/,
    );
    expect(inserts).toHaveLength(0);
  });

  it("needs a project, a quantity above zero and a date", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const inserts = fakeSupabase();

    expect((await allocateLeftover(fields({ projectId: "" }))).error).toMatch(
      /Choose the project/,
    );
    expect((await allocateLeftover(fields({ qty: "0" }))).error).toMatch(
      /above zero/,
    );
    expect((await allocateLeftover(fields({ usedOn: "" }))).error).toMatch(
      /Enter the date/,
    );
    expect(inserts).toHaveLength(0);
  });

  it("passes on the database's plain message when more than is left is asked for", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase({
      data: null,
      error: { code: "23514", message: "Only 2 left at Best Link." },
    });

    expect((await allocateLeftover(fields())).error).toBe(
      "Only 2 left at Best Link.",
    );
  });
});
