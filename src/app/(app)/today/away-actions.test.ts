import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { addSiteOff, removeSiteOff } from "./away-actions";

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
const AWAY = "22222222-2222-4222-8222-222222222222";

const supervisor: Profile = {
  id: ME,
  fullName: "Awal",
  role: "staff",
  jobRole: "site",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
};

type Result = { error: { code?: string } | null };

/** The table calls made, with what each insert or delete carried. */
function fakeSupabase(result: Result = { error: null }) {
  const calls: { table: string; step: string; payload: unknown }[] = [];
  const client = {
    from: vi.fn((table: string) => ({
      insert: (payload: unknown) => {
        calls.push({ table, step: "insert", payload });
        return Promise.resolve(result);
      },
      delete: () => ({
        eq: (_column: string, value: unknown) => {
          calls.push({ table, step: "delete", payload: value });
          return Promise.resolve(result);
        },
      }),
    })),
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

const awayForm = (fields: Record<string, string> = {}) =>
  form({
    kind: "office",
    startsOn: "2026-11-10",
    endsOn: "2026-11-11",
    note: " Quotation work ",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCurrentProfile).mockResolvedValue(supervisor);
});

describe("addSiteOff", () => {
  it("saves the supervisor's own office days with a trimmed note", async () => {
    const calls = fakeSupabase();

    expect(await addSiteOff(awayForm())).toEqual({ error: null });

    expect(calls).toEqual([
      {
        table: "site_off",
        step: "insert",
        payload: {
          profile_id: ME,
          kind: "office",
          starts_on: "2026-11-10",
          ends_on: "2026-11-11",
          note: "Quotation work",
        },
      },
    ]);
  });

  it("rejects leave, which belongs to the Leave module", async () => {
    const calls = fakeSupabase();

    const result = await addSiteOff(awayForm({ kind: "leave" }));

    expect(result.error).toBe("Choose office or other.");
    expect(calls).toHaveLength(0);
  });

  it("rejects an end date before the start date", async () => {
    const calls = fakeSupabase();

    const result = await addSiteOff(awayForm({ endsOn: "2026-11-09" }));

    expect(result.error).toBe("The last day is before the first day.");
    expect(calls).toHaveLength(0);
  });

  it("says who may add days when the database refuses", async () => {
    fakeSupabase({ error: { code: "42501" } });

    const result = await addSiteOff(awayForm());

    expect(result.error).toBe("Only a site supervisor can record a day away.");
  });
});

describe("removeSiteOff", () => {
  it("removes the day by id", async () => {
    const calls = fakeSupabase();

    expect(await removeSiteOff(AWAY)).toEqual({ error: null });

    expect(calls).toEqual([
      { table: "site_off", step: "delete", payload: AWAY },
    ]);
  });

  it("rejects an id that is not a record id", async () => {
    const calls = fakeSupabase();

    const result = await removeSiteOff("nope");

    expect(result.error).toMatch(/Could not find that day/);
    expect(calls).toHaveLength(0);
  });
});
