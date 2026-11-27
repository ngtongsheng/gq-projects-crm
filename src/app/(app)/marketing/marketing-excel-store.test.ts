import { describe, expect, it } from "vitest";
import type { createClient } from "@/lib/supabase/server";
import type { ImportPlan } from "./marketing-excel-plan";
import { applyMarketingImport } from "./marketing-excel-store";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const OLD_EXPENSE = "11111111-1111-4111-8111-111111111111";
const OLD_PREPAID = "22222222-2222-4222-8222-222222222222";
const CATEGORY = "33333333-3333-4333-8333-333333333333";

// Records every write in order. `failOn` makes inserts into that table fail.
function fakeDatabase(failOn?: string) {
  const log: string[] = [];
  const answer = (data: unknown, error: { code: string } | null = null) => ({
    data,
    error,
  });
  const read = (data: unknown) => {
    const query: Promise<ReturnType<typeof answer>> & {
      order: () => unknown;
      range: () => unknown;
      limit: () => unknown;
    } = Object.assign(Promise.resolve(answer(data)), {
      order: () => query,
      range: () => query,
      limit: () => query,
    });
    return query;
  };
  const rows: Record<string, unknown[]> = {
    marketing_expenses: [{ id: OLD_EXPENSE }],
    marketing_prepaid_entries: [{ id: OLD_PREPAID }],
    marketing_vendors: [],
    marketing_categories: [{ sort_order: 4 }],
  };
  const client = {
    from: (table: string) => ({
      select: () => read(rows[table] ?? []),
      insert: (inserted: unknown[]) => {
        log.push(`insert ${table} ${inserted.length}`);
        return Promise.resolve(
          answer(null, table === failOn ? { code: "23505" } : null),
        );
      },
      delete: () => ({
        in: (_column: string, ids: string[]) => {
          log.push(`delete ${table} ${ids.length}`);
          return { select: () => Promise.resolve(answer([])) };
        },
      }),
      update: () => ({
        eq: () => ({ select: () => Promise.resolve(answer([])) }),
      }),
    }),
  };
  return { log, client: client as unknown as Supabase };
}

const plan = (overrides: Partial<ImportPlan>): ImportPlan => ({
  newCategories: [],
  events: [],
  costs: [],
  expenses: [],
  prepaid: [],
  giveaways: [],
  found: { expenses: false, events: false, prepaid: false, giveaways: false },
  errors: [],
  ...overrides,
});

const expense = {
  id: null,
  spentOn: "2026-03-05",
  categoryId: CATEGORY,
  description: "Folders",
  vendor: "Print Co",
  invoiceRef: null,
  currency: "RM" as const,
  amount: 10,
  amountRm: 10,
  eventId: null,
  paymentMethod: "cash" as const,
  remarks: null,
};

const cost = {
  id: null,
  eventId: "44444444-4444-4444-8444-444444444444",
  costGroup: "Booth",
  description: null,
  supplierRef: null,
  foreignAmount: null,
  rate: 100,
  unit: "ls",
  qty: 1,
  remarks: null,
};

describe("applyMarketingImport", () => {
  it("adds on top without removing anything", async () => {
    const { log, client } = fakeDatabase();
    const result = await applyMarketingImport(
      client,
      plan({
        expenses: [expense],
        found: {
          expenses: true,
          events: false,
          prepaid: false,
          giveaways: false,
        },
      }),
      false,
    );

    expect(result.error).toBeNull();
    expect(log).toEqual([
      "insert marketing_vendors 1",
      "insert marketing_expenses 1",
    ]);
  });

  it("replaces only the kinds of sheet the file has, and removes the old lines after the new ones are in", async () => {
    const { log, client } = fakeDatabase();
    const result = await applyMarketingImport(
      client,
      plan({
        expenses: [expense],
        found: {
          expenses: true,
          events: false,
          prepaid: false,
          giveaways: false,
        },
      }),
      true,
    );

    expect(result.error).toBeNull();
    // Prepaid lines are in the app but not in the file, so they stay.
    expect(log).toEqual([
      "insert marketing_vendors 1",
      "insert marketing_expenses 1",
      "delete marketing_expenses 1",
    ]);
  });

  it("takes the new lines back out and keeps the old ones when an insert fails", async () => {
    const { log, client } = fakeDatabase("marketing_expenses");
    const result = await applyMarketingImport(
      client,
      plan({
        costs: [cost],
        expenses: [expense],
        found: {
          expenses: true,
          events: true,
          prepaid: false,
          giveaways: false,
        },
      }),
      true,
    );

    expect(result.error).toEqual({ code: "23505" });
    expect(log).toEqual([
      "insert marketing_vendors 1",
      "insert marketing_event_costs 1",
      "insert marketing_expenses 1",
      // The cost line just added goes again; the old expense is never touched.
      "delete marketing_event_costs 1",
    ]);
  });
});
