import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { recordPayment, removePayment } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const MOF = "33333333-3333-4333-8333-333333333333";
const PAYMENT = "44444444-4444-4444-8444-444444444444";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

type Selected = Promise<Result> & {
  eq: () => Selected;
  maybeSingle: () => Promise<Result>;
};

const ORDER_OF_5000: Result = {
  data: { contract_sum: 5000, vo_amount: 0, payments: [] },
  error: null,
};

/** Writes resolve with `result`, the order read with `order`; the first insert payload and the table are recorded. */
function fakeSupabase(result: Result, order: Result = ORDER_OF_5000) {
  const record: { table?: string; insert?: unknown; deleted?: string } = {};
  const client = {
    from: vi.fn((table: string) => {
      if (table !== "mofs") record.table = table;
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
      query.select = () => {
        const selected: Selected = Object.assign(Promise.resolve(result), {
          eq: () => selected,
          maybeSingle: () => Promise.resolve(order),
        });
        return selected;
      };
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

const paymentFields = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    amount: "RM 1,500.50",
    receivedOn: "2026-11-01",
    note: "  Cheque 1234 ",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("recordPayment", () => {
  it("records the amount in ringgit for the MD", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase({ data: null, error: null });

    expect(await recordPayment(paymentFields())).toEqual({ error: null });
    expect(record.table).toBe("payments");
    expect(record.insert).toEqual({
      mof_id: MOF,
      amount: 1500.5,
      received_on: "2026-11-01",
      note: "Cheque 1234",
    });
  });

  it("lets HR & Accounts record a payment with no note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const record = fakeSupabase({ data: null, error: null });

    expect(await recordPayment(paymentFields({ note: "" }))).toEqual({
      error: null,
    });
    expect(record.insert).toMatchObject({ note: null });
  });

  it("turns away everyone else before touching the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayment(paymentFields());

    expect(result.error).toMatch(/Only the MD and HR & Accounts/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["no amount", { amount: "" }],
    ["text for an amount", { amount: "lots" }],
    ["zero", { amount: "0" }],
    ["a negative amount", { amount: "-50" }],
    ["too large an amount", { amount: "1000000000000" }],
    ["no date", { receivedOn: "" }],
    ["a bad date", { receivedOn: "2026-13-40" }],
    ["an order id that is not one", { mofId: "nope" }],
  ])("rejects %s", async (_name, fields) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null });

    const result = await recordPayment(paymentFields(fields));

    expect(result.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a date in the future", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null });
    const nextYear = `${Number(todayMyt().slice(0, 4)) + 1}-01-01`;

    const result = await recordPayment(paymentFields({ receivedOn: nextYear }));

    expect(result.error).toBe("That date is in the future.");
  });

  it("refuses a payment that takes the total past the order total", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase(
      { data: null, error: null },
      {
        data: {
          contract_sum: 4000,
          vo_amount: 1000,
          payments: [{ amount: 3500 }],
        },
        error: null,
      },
    );

    const result = await recordPayment(paymentFields({ amount: "1500.01" }));

    expect(result.error).toMatch(/past the order total of RM 5,000.00/);
    expect(record.insert).toBeUndefined();
  });

  it("accepts the payment that settles the order exactly", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const record = fakeSupabase(
      { data: null, error: null },
      {
        data: {
          contract_sum: 4000,
          vo_amount: 1000,
          payments: [{ amount: 3500 }],
        },
        error: null,
      },
    );

    expect(await recordPayment(paymentFields({ amount: "1500" }))).toEqual({
      error: null,
    });
    expect(record.insert).toMatchObject({ amount: 1500 });
  });

  it("says when the order is not there to be paid against", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: null }, { data: null, error: null });

    expect((await recordPayment(paymentFields())).error).toMatch(
      /Could not find that order/,
    );
  });

  it("explains when the database refuses", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: { code: "42501" } });

    expect((await recordPayment(paymentFields())).error).toMatch(/Only the MD/);
  });

  it("shows the database's refusal when another payment took the order past its total", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const message =
      "That takes payments past the order total of RM 5,000.00. If the order total has changed, change it on the MOF first.";
    fakeSupabase({ data: null, error: { code: "23514", message } });

    expect((await recordPayment(paymentFields())).error).toBe(message);
  });

  it("says when the order is gone", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: null, error: { code: "23503" } });

    expect((await recordPayment(paymentFields())).error).toMatch(
      /Could not find that order/,
    );
  });
});

describe("removePayment", () => {
  it("removes a payment for HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const record = fakeSupabase({ data: [{ id: PAYMENT }], error: null });

    expect(await removePayment(PAYMENT)).toEqual({ error: null });
    expect(record.deleted).toBe(PAYMENT);
  });

  it("reports a payment the database would not remove", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({ data: [], error: null });

    expect((await removePayment(PAYMENT)).error).toMatch(
      /Could not find that payment/,
    );
  });

  it("turns away other roles", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    fakeSupabase({ data: [{ id: PAYMENT }], error: null });

    expect((await removePayment(PAYMENT)).error).toMatch(/Only the MD/);
    expect(createClient).not.toHaveBeenCalled();
  });
});
