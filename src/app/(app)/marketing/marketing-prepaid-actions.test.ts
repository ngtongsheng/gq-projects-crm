import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  deletePrepaidEntry,
  savePrepaidAlert,
  savePrepaidEntry,
} from "./marketing-prepaid-actions";

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
const ENTRY = "44444444-4444-4444-8444-444444444444";

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

/** A database with one vendor, "Europe designer", that records every write; `change` answers an entry write. */
function givenDatabase(
  change: { data?: unknown[]; error?: { code: string } | null } = {},
  balance: { balance: number; low: boolean } | null = {
    balance: 799.5,
    low: true,
  },
) {
  const done = (table: string, op: string, row?: Record<string, unknown>) => {
    writes.push({ table, op, row });
    const answer = {
      data:
        table === "marketing_vendors" && op === "insert"
          ? { id: VENDOR }
          : (change.data ?? [{ id: ENTRY }]),
      error:
        table === "marketing_vendors" && op === "insert"
          ? null
          : (change.error ?? null),
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
      select: () =>
        table === "marketing_prepaid_balances"
          ? {
              eq: () => ({
                maybeSingle: async () => ({ data: balance, error: null }),
              }),
            }
          : Promise.resolve({
              data: [{ id: VENDOR, name: "Europe designer" }],
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

const topUp = {
  id: "",
  kind: "top_up",
  entryOn: "2026-11-17",
  vendor: "europe designer",
  description: " Advance ",
  foreignCurrency: "EUR",
  foreignAmount: "1000",
  amountRm: "5000",
  mofRef: "",
  marketingFoc: false,
  remarks: "",
};

const deduction = {
  ...topUp,
  kind: "deduction",
  description: "Stuarts Design – Hannan Medicare",
  foreignAmount: "60",
  amountRm: "288",
  mofRef: "P1513",
  marketingFoc: true,
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("savePrepaidEntry", () => {
  it("adds a top-up to the vendor with that name and answers with the new balance", async () => {
    givenDatabase();
    expect(await savePrepaidEntry(topUp)).toEqual({
      error: null,
      balance: 799.5,
      low: true,
    });
    expect(writes).toEqual([
      {
        table: "marketing_prepaid_entries",
        op: "insert",
        row: {
          entry_on: "2026-11-17",
          vendor_id: VENDOR,
          kind: "top_up",
          description: "Advance",
          foreign_currency: "EUR",
          foreign_amount: 1000,
          amount_rm: 5000,
          mof_ref: null,
          marketing_foc: false,
          remarks: null,
        },
      },
    ]);
  });

  it("adds a deduction that names the client and project, and may be a marketing cost", async () => {
    givenDatabase();
    await savePrepaidEntry(deduction);
    expect(writes[0]?.row).toMatchObject({
      kind: "deduction",
      description: "Stuarts Design – Hannan Medicare",
      mof_ref: "P1513",
      marketing_foc: true,
    });
  });

  it.each([
    ["blank", ""],
    ["spaces", "   "],
  ])(
    "asks for the client and project when a deduction has %s",
    async (_name, description) => {
      givenDatabase();
      expect(await savePrepaidEntry({ ...deduction, description })).toEqual({
        error: "Key in the client – project.",
      });
      expect(writes).toEqual([]);
    },
  );

  it("does not need a description for a top-up", async () => {
    givenDatabase();
    expect(await savePrepaidEntry({ ...topUp, description: "" })).toMatchObject(
      { error: null },
    );
    expect(writes[0]?.row).toMatchObject({ description: null });
  });

  it("never marks a top-up as a marketing cost", async () => {
    givenDatabase();
    await savePrepaidEntry({ ...topUp, marketingFoc: true });
    expect(writes[0]?.row).toMatchObject({ marketing_foc: false });
  });

  it("keeps no foreign currency when no foreign amount is keyed in", async () => {
    givenDatabase();
    await savePrepaidEntry({ ...topUp, foreignAmount: "" });
    expect(writes[0]?.row).toMatchObject({
      foreign_currency: null,
      foreign_amount: null,
    });
  });

  it.each([
    ["date", { entryOn: "" }],
    ["vendor", { vendor: " " }],
    ["RM amount", { amountRm: "" }],
    ["zero RM amount", { amountRm: "0" }],
  ])(
    "asks for date, vendor and the RM amount when the %s is missing",
    async (_name, change) => {
      givenDatabase();
      expect(await savePrepaidEntry({ ...topUp, ...change })).toEqual({
        error: "Fill in date, vendor and the RM amount.",
      });
      expect(writes).toEqual([]);
    },
  );

  it("adds a vendor it has not seen, which is a new account", async () => {
    givenDatabase();
    await savePrepaidEntry({ ...topUp, vendor: " New Printer " });
    expect(writes.map((write) => [write.table, write.row?.name ?? ""])).toEqual(
      [
        ["marketing_vendors", "New Printer"],
        ["marketing_prepaid_entries", ""],
      ],
    );
  });

  it("saves changes to an entry without sending its kind", async () => {
    givenDatabase();
    await savePrepaidEntry({ ...deduction, id: ENTRY });
    expect(writes[0]).toMatchObject({
      table: "marketing_prepaid_entries",
      op: "update",
    });
    expect(writes[0]?.row).not.toHaveProperty("kind");
  });

  it("still saves when the balance cannot be read", async () => {
    givenDatabase({}, null);
    expect(await savePrepaidEntry(topUp)).toEqual({ error: null });
  });

  it("refuses HR & Accounts, who only look", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect(await savePrepaidEntry(topUp)).toEqual({
      error: "You can look at this page but not change it.",
    });
    expect(writes).toEqual([]);
  });

  it("says so when the entry to change is gone", async () => {
    givenDatabase({ data: [] });
    expect(await savePrepaidEntry({ ...topUp, id: ENTRY })).toEqual({
      error: "Could not find that entry. Reload the page.",
    });
  });

  it("does not show the database's wording when a save fails", async () => {
    givenDatabase({ error: { code: "XX000" } });
    expect(await savePrepaidEntry(topUp)).toEqual({
      error: "Could not save. Try again.",
    });
  });
});

describe("deletePrepaidEntry", () => {
  it("deletes an entry", async () => {
    givenDatabase();
    expect(await deletePrepaidEntry(ENTRY)).toEqual({ error: null });
    expect(writes).toEqual([
      { table: "marketing_prepaid_entries", op: "delete", row: undefined },
    ]);
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await deletePrepaidEntry(ENTRY)).error).toBe(
      "You can look at this page but not change it.",
    );
    expect(writes).toEqual([]);
  });
});

describe("savePrepaidAlert", () => {
  it("sets the balance an account is warned below", async () => {
    givenDatabase();
    expect(
      await savePrepaidAlert({ vendorId: VENDOR, alert: "1,500" }),
    ).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "marketing_vendors",
        op: "update",
        row: { low_balance_alert: 1500 },
      },
    ]);
  });

  it("turns the alert off when blank", async () => {
    givenDatabase();
    await savePrepaidAlert({ vendorId: VENDOR, alert: "" });
    expect(writes[0]?.row).toEqual({ low_balance_alert: 0 });
  });

  it("refuses a negative or non-numeric alert", async () => {
    givenDatabase();
    expect(
      (await savePrepaidAlert({ vendorId: VENDOR, alert: "-5" })).error,
    ).toBe("The alert must be an amount in RM, or blank to turn it off.");
    expect(
      (await savePrepaidAlert({ vendorId: VENDOR, alert: "abc" })).error,
    ).toBe("The alert must be an amount in RM, or blank to turn it off.");
    expect(writes).toEqual([]);
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect(
      (await savePrepaidAlert({ vendorId: VENDOR, alert: "100" })).error,
    ).toBe("You can look at this page but not change it.");
  });
});
