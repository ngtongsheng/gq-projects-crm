import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { recordPayout, removePayout } from "./actions";
import { type CommissionLine, loadCommissionLines } from "./commission-data";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./commission-data", () => ({ loadCommissionLines: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const MOF = "33333333-3333-4333-8333-333333333333";
const PAYOUT = "44444444-4444-4444-8444-444444444444";
const SARAH = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

/** Sarah has RM 1,000 left to pay out on the order. */
const line = (payableNow: number) =>
  ({ personId: SARAH, balance: { payableNow } }) as unknown as CommissionLine;

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

function fakeSupabase(result: Result) {
  const record: { table?: string; insert?: unknown; deleted?: string } = {};
  const client = {
    from: vi.fn((table: string) => {
      record.table = table;
      const query: Record<string, unknown> = {};
      query.insert = (payload: unknown) => {
        record.insert = payload;
        return Promise.resolve(result);
      };
      query.delete = () => query;
      query.eq = (_column: string, value: string) => {
        record.deleted = value;
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

const payoutFields = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    profileId: SARAH,
    amount: "RM 400.50",
    paidOn: "2026-11-01",
    note: "  Nov payroll ",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadCommissionLines).mockResolvedValue([line(1_000)]);
});

describe("recordPayout", () => {
  it("records the amount in ringgit for the MD", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase({ data: null, error: null });

    expect(await recordPayout(payoutFields())).toEqual({ error: null });
    expect(record.table).toBe("commission_payouts");
    expect(record.insert).toEqual({
      profile_id: SARAH,
      mof_id: MOF,
      amount: 400.5,
      paid_on: "2026-11-01",
      note: "Nov payroll",
    });
  });

  it("allows paying out exactly what is left", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    fakeSupabase({ data: null, error: null });

    expect(await recordPayout(payoutFields({ amount: "1000" }))).toEqual({
      error: null,
    });
  });

  it("rejects a payout over what is left", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase({ data: null, error: null });

    const result = await recordPayout(payoutFields({ amount: "1000.01" }));

    expect(result.error).toBe(
      "That is more than the RM 1,000.00 left to pay out.",
    );
    expect(record.insert).toBeUndefined();
  });

  it("rejects any payout while nothing is claimable yet", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    vi.mocked(loadCommissionLines).mockResolvedValue([line(0)]);
    const record = fakeSupabase({ data: null, error: null });

    const result = await recordPayout(payoutFields({ amount: "1" }));

    expect(result.error).toBe("Nothing can be paid out on this order yet.");
    expect(record.insert).toBeUndefined();
  });

  it("rejects a person who has no commission on the order", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayout(
      payoutFields({ profileId: "66666666-6666-4666-8666-666666666666" }),
    );

    expect(result.error).toMatch(/no commission on this order/);
  });

  it.each([
    "director",
    "sales",
    "bd",
  ] as const)("turns %s away before touching the database", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayout(payoutFields());

    expect(result.error).toMatch(/Only the MD and HR & Accounts/);
    expect(createClient).not.toHaveBeenCalled();
    expect(loadCommissionLines).not.toHaveBeenCalled();
  });

  it.each([
    ["no amount", { amount: "" }],
    ["text for an amount", { amount: "lots" }],
    ["zero", { amount: "0" }],
    ["a negative amount", { amount: "-50" }],
    ["no date", { paidOn: "" }],
    ["a bad date", { paidOn: "2026-13-40" }],
    ["an order id that is not one", { mofId: "nope" }],
    ["a person id that is not one", { profileId: "nope" }],
  ])("rejects %s", async (_name, fields) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayout(payoutFields(fields));

    expect(result.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a date in the future", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayout(payoutFields({ paidOn: "2999-01-01" }));

    expect(result.error).toBe("That date is in the future.");
  });

  it("explains when the database refuses", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: { code: "42501" } });

    expect((await recordPayout(payoutFields())).error).toMatch(/Only the MD/);
  });

  it("shows the database's cap message when a payout landed first", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const message = "That is more than the RM 100.00 left to pay out.";
    fakeSupabase({ data: null, error: { code: "23514", message } });

    expect(await recordPayout(payoutFields())).toEqual({ error: message });
  });
});

describe("removePayout", () => {
  it("removes a payout for HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const record = fakeSupabase({ data: [{ id: PAYOUT }], error: null });

    expect(await removePayout(PAYOUT)).toEqual({ error: null });
    expect(record.deleted).toBe(PAYOUT);
  });

  it("reports a payout the database would not remove", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: [], error: null });

    expect((await removePayout(PAYOUT)).error).toMatch(
      /Could not find that payout/,
    );
  });

  it("turns away other roles", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    fakeSupabase({ data: [{ id: PAYOUT }], error: null });

    expect((await removePayout(PAYOUT)).error).toMatch(/Only the MD/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
