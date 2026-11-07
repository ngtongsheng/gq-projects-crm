import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { loadPurchasingFacts } from "./purchasing-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const po = (poDate: string) => ({
  status: "ordered",
  po_date: poDate,
  lead_time_days: 30,
});

function fakeSupabase(orders: unknown[]) {
  const from = vi.fn((table: string) => {
    if (table === "mofs") {
      return {
        select: () => ({
          neq: async () => ({ data: orders, error: null }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          not: async () => ({ count: 2, error: null }),
        }),
      }),
    };
  });
  vi.mocked(createClient).mockResolvedValue({
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

describe("loadPurchasingFacts: POs issued this month", () => {
  it("counts only the supplier POs dated in the month of today", async () => {
    fakeSupabase([
      {
        stage: "ordered",
        mof_lines: [],
        supplier_pos: [po("2026-11-02"), po("2026-10-30"), po("2025-11-10")],
      },
      {
        stage: "in_production",
        mof_lines: [],
        supplier_pos: [po("2026-11-05")],
      },
    ]);

    const facts = await loadPurchasingFacts("2026-11-06");

    expect(facts.posIssuedThisMonth).toBe(2);
  });

  it("is zero when no PO is dated this month", async () => {
    fakeSupabase([
      { stage: "ordered", mof_lines: [], supplier_pos: [po("2026-09-15")] },
    ]);

    const facts = await loadPurchasingFacts("2026-11-06");

    expect(facts.posIssuedThisMonth).toBe(0);
    expect(facts.unsignedDos).toBe(2);
  });
});
