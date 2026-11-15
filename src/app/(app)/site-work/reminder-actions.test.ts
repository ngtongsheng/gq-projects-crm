import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveSiteReminders } from "./reminder-actions";

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

const supervisor = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const owner = "44444444-4444-4444-8444-444444444444";

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

function fakeSupabase(
  stored: unknown,
  error: { code?: string; message?: string } | null = null,
) {
  const upserts: { row: unknown }[] = [];
  const client = {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: stored === undefined ? null : { value: stored },
              error: null,
            }),
        }),
      }),
      upsert: (row: unknown) => {
        upserts.push({ row });
        return Promise.resolve({ data: null, error });
      },
    })),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return upserts;
}

const form = (change: Record<string, string> = {}) => {
  const data = new FormData();
  const values: Record<string, string> = {
    dailyTime: "16:30",
    nextMorningTime: "09:15",
    officeWhatsApp: "012-345 6789",
    supervisorId: supervisor,
    [`via-${supervisor}`]: "both",
    [`whatsapp-${supervisor}`]: "012-111 2222",
    [`email-${supervisor}`]: "ali@example.com",
    [`language-${supervisor}`]: "en",
    ...change,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  data.append("missingListTo", owner);
  return data;
};

beforeEach(() => vi.clearAllMocks());

describe("saveSiteReminders", () => {
  it("saves the settings for the MD and keeps supervisors that are not on the form", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const kept = {
      via: "email",
      whatsapp: "",
      email: "b@c.co",
      language: "bm",
    };
    const upserts = fakeSupabase({ supervisors: { [other]: kept } });

    expect(await saveSiteReminders(form())).toEqual({ error: null });

    expect(upserts[0]?.row).toEqual({
      key: "site_reminders",
      value: {
        dailyTime: "16:30",
        nextMorningTime: "09:15",
        missingListTo: [owner],
        officeWhatsApp: "012-345 6789",
        supervisors: {
          [other]: kept,
          [supervisor]: {
            via: "both",
            whatsapp: "012-111 2222",
            email: "ali@example.com",
            language: "en",
          },
        },
      },
    });
  });

  it("refuses anyone but the MD or an admin", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const upserts = fakeSupabase(undefined);
    expect((await saveSiteReminders(form())).error).toMatch(
      /Only the MD or an admin/,
    );
    expect(upserts).toHaveLength(0);
  });

  it("rejects a bad time or email without saving", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const upserts = fakeSupabase(undefined);
    expect((await saveSiteReminders(form({ dailyTime: "" }))).error).toBe(
      "Use a time like 17:00.",
    );
    expect(
      (await saveSiteReminders(form({ [`email-${supervisor}`]: "nope" })))
        .error,
    ).toBe("Check the email address.");
    expect(upserts).toHaveLength(0);
  });

  it("explains a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase(undefined, { code: "42501" });
    expect((await saveSiteReminders(form())).error).toMatch(
      /Only the MD or an admin/,
    );
  });
});
