import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  deleteMarketingVendor,
  saveMarketingVendor,
} from "./marketing-vendor-actions";

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
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const VENDOR = "33333333-3333-4333-8333-333333333333";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
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

type Write = { op: string; row?: Record<string, unknown> };
const writes: Write[] = [];

function givenDatabase(
  change: { data?: unknown[]; error?: { code: string } | null } = {},
) {
  const done = (op: string, row?: Record<string, unknown>) => {
    writes.push({ op, row });
    const answer = {
      data: change.data ?? [{ id: VENDOR }],
      error: change.error ?? null,
    };
    const chain = {
      eq: () => chain,
      select: () => Promise.resolve(answer),
    };
    return chain;
  };
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => done("insert", row),
      update: (row: Record<string, unknown>) => done("update", row),
      delete: () => done("delete"),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const company = {
  id: "",
  kind: "company",
  name: " Mega Print ",
  supplies: "printing",
  contactPerson: " Aisha ",
  skills: ["photography"],
  rate: "RM 50/hr",
  portfolioUrl: "mega.example",
  phone: "",
  email: "",
  notes: "",
};

const partTimer = {
  ...company,
  kind: "part_timer",
  name: "Ben Lee",
  phone: "012-345 6789",
  portfolioUrl: "mega.example/work",
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("saveMarketingVendor", () => {
  it("adds a company and drops the part-timer fields", async () => {
    givenDatabase();
    expect(await saveMarketingVendor(company)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        op: "insert",
        row: {
          kind: "company",
          name: "Mega Print",
          supplies: "printing",
          contact_person: "Aisha",
          skills: [],
          rate: null,
          portfolio_url: null,
          phone: null,
          email: null,
          notes: null,
        },
      },
    ]);
  });

  it("adds a part-timer, drops the company fields and completes the portfolio link", async () => {
    givenDatabase();
    await saveMarketingVendor(partTimer);
    expect(writes[0]?.row).toMatchObject({
      kind: "part_timer",
      supplies: null,
      contact_person: null,
      skills: ["photography"],
      rate: "RM 50/hr",
      portfolio_url: "https://mega.example/work",
      phone: "012-345 6789",
    });
  });

  it("accepts a part-timer with an email and no phone", async () => {
    givenDatabase();
    expect(
      await saveMarketingVendor({
        ...partTimer,
        phone: "",
        email: "ben@example.com",
      }),
    ).toEqual({ error: null });
  });

  it("asks a part-timer for a phone number or an email", async () => {
    givenDatabase();
    expect(await saveMarketingVendor({ ...partTimer, phone: "" })).toEqual({
      error: "A part-timer needs a phone number or an email.",
    });
    expect(writes).toEqual([]);
  });

  it.each([
    ["name", { name: "  " }, "Fill in the name."],
    ["email", { email: "not-an-email" }, "The email is not valid."],
  ])("refuses a bad %s", async (_field, change, message) => {
    givenDatabase();
    expect(await saveMarketingVendor({ ...company, ...change })).toEqual({
      error: message,
    });
    expect(writes).toEqual([]);
  });

  it("saves changes to an existing vendor", async () => {
    givenDatabase();
    await saveMarketingVendor({ ...company, id: VENDOR });
    expect(writes[0]?.op).toBe("update");
  });

  it("says so when the name is taken, whatever its capitalisation", async () => {
    givenDatabase({ error: { code: "23505" } });
    expect(await saveMarketingVendor(company)).toEqual({
      error: "A vendor with that name already exists.",
    });
  });

  it("says so when the vendor to change is gone", async () => {
    givenDatabase({ data: [] });
    expect(await saveMarketingVendor({ ...company, id: VENDOR })).toEqual({
      error: "Could not find that vendor. Reload the page.",
    });
  });

  it("refuses HR & Accounts, who only look", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await saveMarketingVendor(company)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});

describe("deleteMarketingVendor", () => {
  it("deletes a vendor nobody was paid through", async () => {
    givenDatabase();
    expect(await deleteMarketingVendor(VENDOR)).toEqual({ error: null });
    expect(writes).toEqual([{ op: "delete", row: undefined }]);
  });

  it("explains the refusal when an expense or prepaid entry uses the vendor", async () => {
    givenDatabase({ error: { code: "23503" } });
    expect(await deleteMarketingVendor(VENDOR)).toEqual({
      error:
        "This vendor has expenses or prepaid entries, so it can't be deleted.",
    });
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await deleteMarketingVendor(VENDOR)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});
