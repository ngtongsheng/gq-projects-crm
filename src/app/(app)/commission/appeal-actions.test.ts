import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { decideAppeal, sendAppeal } from "./appeal-actions";
import { type CommissionLine, loadCommissionLines } from "./commission-data";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("./commission-data", () => ({ loadCommissionLines: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const MOF = "33333333-3333-4333-8333-333333333333";
const APPEAL = "44444444-4444-4444-8444-444444444444";
const SARAH = "55555555-5555-4555-8555-555555555555";
const REASON =
  "Client is a GLC; their finance takes about 4 months for every payment.";

const profile = (jobRole: Profile["jobRole"], id = SARAH): Profile => ({
  id,
  fullName: "Sarah",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: true,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

const sarahsLine = { personId: SARAH } as unknown as CommissionLine;

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

function fakeSupabase(result: Result) {
  const record: {
    table?: string;
    insert?: unknown;
    update?: unknown;
    filters: [string, string][];
  } = { filters: [] };
  const client = {
    from: vi.fn((table: string) => {
      record.table = table;
      const query: Record<string, unknown> = {};
      query.insert = (payload: unknown) => {
        record.insert = payload;
        return Promise.resolve(result);
      };
      query.update = (payload: unknown) => {
        record.update = payload;
        return query;
      };
      query.eq = (column: string, value: string) => {
        record.filters.push([column, value]);
        return query;
      };
      query.select = () => Promise.resolve(result);
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return record;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadCommissionLines).mockResolvedValue([sarahsLine]);
});

describe("sendAppeal", () => {
  it("sends the trimmed reason on the salesperson's own commission", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const record = fakeSupabase({ data: null, error: null });

    const result = await sendAppeal(
      form({ mofId: MOF, reason: `  ${REASON} ` }),
    );

    expect(result).toEqual({ error: null });
    expect(loadCommissionLines).toHaveBeenCalledWith(MOF);
    expect(record.table).toBe("commission_appeals");
    expect(record.insert).toEqual({ mof_id: MOF, reason: REASON });
  });

  it.each([
    ["", "Explain the reason in a sentence or two."],
    ["  too short ", "Explain the reason in a sentence or two."],
    ["x".repeat(1001), "Keep the reason under 1,000 characters."],
  ])("refuses the reason %j", async (reason, message) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const record = fakeSupabase({ data: null, error: null });

    expect(await sendAppeal(form({ mofId: MOF, reason }))).toEqual({
      error: message,
    });
    expect(record.insert).toBeUndefined();
  });

  it("accepts a reason of exactly 10 characters", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ data: null, error: null });

    expect(
      await sendAppeal(form({ mofId: MOF, reason: "0123456789" })),
    ).toEqual({ error: null });
  });

  it("refuses an order the person has no commission on", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(
      profile("sales", "66666666-6666-4666-8666-666666666666"),
    );
    const record = fakeSupabase({ data: null, error: null });

    const result = await sendAppeal(form({ mofId: MOF, reason: REASON }));

    expect(result.error).toBe("You have no commission on this order.");
    expect(record.insert).toBeUndefined();
  });

  it("explains that an appeal is already waiting or approved", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ data: null, error: { code: "23505" } });

    const result = await sendAppeal(form({ mofId: MOF, reason: REASON }));

    expect(result.error).toMatch(/already have an appeal waiting or approved/);
  });
});

describe("decideAppeal", () => {
  const decision = (fields: Record<string, string> = {}) =>
    form({
      appealId: APPEAL,
      decision: "approved",
      reply: " Special approval this time only. ",
      ...fields,
    });

  it.each([
    ["md", "approved"],
    ["accounts", "rejected"],
  ] as const)(
    "lets %s record %s with the note, on a pending appeal only",
    async (jobRole, status) => {
      vi.mocked(getCurrentProfile).mockResolvedValue(
        profile(jobRole, "77777777-7777-4777-8777-777777777777"),
      );
      const record = fakeSupabase({ data: [{ id: APPEAL }], error: null });

      expect(await decideAppeal(decision({ decision: status }))).toEqual({
        error: null,
      });
      expect(record.update).toEqual({
        status,
        reply: "Special approval this time only.",
      });
      expect(record.filters).toEqual([
        ["id", APPEAL],
        ["status", "pending"],
      ]);
    },
  );

  it.each(["sales", "director"] as const)("refuses %s", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const record = fakeSupabase({ data: [{ id: APPEAL }], error: null });

    expect((await decideAppeal(decision())).error).toBe(
      "Only the MD and HR & Accounts can decide an appeal.",
    );
    expect(record.update).toBeUndefined();
  });

  it("needs a note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase({ data: [{ id: APPEAL }], error: null });

    expect((await decideAppeal(decision({ reply: "  " }))).error).toBe(
      "Write a short note.",
    );
    expect(record.update).toBeUndefined();
  });

  it("refuses a decision other than approve or reject", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: [{ id: APPEAL }], error: null });

    expect((await decideAppeal(decision({ decision: "pending" }))).error).toBe(
      "Choose approve or reject.",
    );
  });

  it("says so when the appeal was already decided", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: [], error: null });

    expect((await decideAppeal(decision())).error).toMatch(
      /may already be decided/,
    );
  });
});
