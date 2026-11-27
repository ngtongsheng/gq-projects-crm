import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  deleteMarketingExpense,
  saveMarketingExpense,
} from "./marketing-expense-actions";

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
const CATEGORY = "22222222-2222-4222-8222-222222222222";
const VENDOR = "33333333-3333-4333-8333-333333333333";
const EXPENSE = "44444444-4444-4444-8444-444444444444";

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

type Write = { table: string; op: string; row?: Record<string, unknown> };
const writes: Write[] = [];

/** A database with one vendor, "Mega Print", that records every write; `change` answers an expense write. */
function givenDatabase(
  change: { data?: unknown[]; error?: { code: string } | null } = {},
) {
  const done = (table: string, op: string, row?: Record<string, unknown>) => {
    writes.push({ table, op, row });
    const answer = {
      data:
        table === "marketing_vendors"
          ? { id: VENDOR }
          : (change.data ?? [{ id: EXPENSE }]),
      error: table === "marketing_vendors" ? null : (change.error ?? null),
    };
    const chain = {
      eq: () => chain,
      select: () => Object.assign(Promise.resolve(answer), chain),
      single: async () => answer,
    };
    return chain;
  };
  const client = {
    from: (table: string) => ({
      select: async () => ({
        data: [{ id: VENDOR, name: "Mega Print" }],
        error: null,
      }),
      insert: (row: Record<string, unknown>) => done(table, "insert", row),
      update: (row: Record<string, unknown>) => done(table, "update", row),
      delete: () => done(table, "delete"),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const expense = {
  id: "",
  spentOn: "2026-11-17",
  categoryId: CATEGORY,
  description: "  Folder printing ",
  vendor: "mega print",
  invoiceRef: "",
  currency: "RM",
  amount: "450",
  amountRm: "",
  eventId: "",
  paymentMethod: "bank_transfer",
  remarks: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("saveMarketingExpense", () => {
  it("adds an expense to the vendor with that name, whatever its capitalisation", async () => {
    givenDatabase();
    expect(await saveMarketingExpense(expense)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "marketing_expenses",
        op: "insert",
        row: {
          spent_on: "2026-11-17",
          category_id: CATEGORY,
          description: "Folder printing",
          vendor_id: VENDOR,
          invoice_ref: null,
          currency: "RM",
          amount: 450,
          amount_rm: 450,
          event_id: null,
          payment_method: "bank_transfer",
          remarks: null,
        },
      },
    ]);
  });

  it("copies the amount into the RM amount for RM, whatever was typed there", async () => {
    givenDatabase();
    await saveMarketingExpense({ ...expense, amountRm: "999" });
    expect(writes[0]?.row).toMatchObject({ amount: 450, amount_rm: 450 });
  });

  it("keeps the RM amount keyed in for a foreign currency", async () => {
    givenDatabase();
    await saveMarketingExpense({
      ...expense,
      currency: "USD",
      amount: "100",
      amountRm: "472.5",
    });
    expect(writes[0]?.row).toMatchObject({
      currency: "USD",
      amount: 100,
      amount_rm: 472.5,
    });
  });

  it("adds a vendor it has not seen before", async () => {
    givenDatabase();
    await saveMarketingExpense({ ...expense, vendor: " New Courier " });
    expect(writes.map((write) => [write.table, write.row?.name ?? ""])).toEqual(
      [
        ["marketing_vendors", "New Courier"],
        ["marketing_expenses", ""],
      ],
    );
  });

  it("saves changes to an existing expense", async () => {
    givenDatabase();
    await saveMarketingExpense({ ...expense, id: EXPENSE });
    expect(writes[0]).toMatchObject({
      table: "marketing_expenses",
      op: "update",
    });
  });

  it.each([
    ["date", { spentOn: "" }],
    ["description", { description: "   " }],
    ["vendor", { vendor: "" }],
    ["amount", { amount: "" }],
    ["zero amount", { amount: "0" }],
  ])(
    "asks for date, description, vendor and amount when the %s is missing",
    async (_name, change) => {
      givenDatabase();
      expect(await saveMarketingExpense({ ...expense, ...change })).toEqual({
        error: "Fill in date, description, vendor and amount.",
      });
      expect(writes).toEqual([]);
    },
  );

  it("asks for the RM amount when the currency is not RM", async () => {
    givenDatabase();
    expect(
      await saveMarketingExpense({ ...expense, currency: "EUR", amountRm: "" }),
    ).toEqual({ error: "Key in the amount in RM." });
    expect(writes).toEqual([]);
  });

  it("refuses HR & Accounts, who only look", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect(await saveMarketingExpense(expense)).toEqual({
      error: "You can look at this page but not change it.",
    });
    expect(writes).toEqual([]);
  });

  it("says so when the expense to change is gone", async () => {
    givenDatabase({ data: [] });
    expect(await saveMarketingExpense({ ...expense, id: EXPENSE })).toEqual({
      error: "Could not find that expense. Reload the page.",
    });
  });

  it("does not show the database's wording when a save fails", async () => {
    givenDatabase({ error: { code: "XX000" } });
    expect(await saveMarketingExpense(expense)).toEqual({
      error: "Could not save. Try again.",
    });
  });
});

describe("deleteMarketingExpense", () => {
  it("deletes an expense", async () => {
    givenDatabase();
    expect(await deleteMarketingExpense(EXPENSE)).toEqual({ error: null });
    expect(writes).toEqual([
      { table: "marketing_expenses", op: "delete", row: undefined },
    ]);
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await deleteMarketingExpense(EXPENSE)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});
