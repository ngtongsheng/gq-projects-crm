import { beforeEach, describe, expect, it, vi } from "vitest";
import { seesMofCost } from "@/lib/auth/page-access";
import type { Viewer } from "@/lib/auth/pages";
import { createClient } from "@/lib/supabase/server";
import { loadQuote, loadQuoteRegister } from "./quote-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/page-access", () => ({ seesMofCost: vi.fn() }));
vi.mock("@/lib/auth/team-directory", () => ({
  getTeamDirectory: async () => [{ id: "p1", name: "Ah Kow" }],
}));

const QUOTE_ID = "8f1c7f5e-2a4b-4c1d-9e3f-0a1b2c3d4e5f";

const viewer: Viewer = {
  jobRole: "director",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
};

// One option at 25% margin: sells 1000, costs 750.
const quote = (id: string, updatedAt: string) => ({
  id,
  quote_no: `Q-${id}`,
  project_id: null,
  project_name: "Office",
  customer_name: "Acme",
  salesperson_id: "p1",
  created_at: updatedAt,
  updated_at: updatedAt,
  quote_revisions: [
    {
      id: `${id}-r0`,
      rev: 0,
      status: "draft",
      fx_usd: 4.5,
      fx_rmb: 0.6024,
      sst_pct: 10,
      target_margin_pct: 30,
      chosen_option_id: null,
      created_at: updatedAt,
      updated_at: updatedAt,
      quote_options: [
        {
          id: `${id}-oA`,
          key: "A",
          label: "",
          quote_items: [
            {
              id: `${id}-i1`,
              position: 0,
              category: "transport",
              type: "lump",
              area: null,
              product: null,
              supplier: null,
              description: null,
              remark: null,
              unit: "trip",
              qty: 1,
              rate: 1000,
              material: null,
              wastage_pct: null,
              underlay: null,
              accessories: null,
              install: null,
              currency: null,
              fob: null,
              fx: null,
              sst_pct: null,
              shipping: null,
              rug_mode: null,
              length: null,
              width: null,
              piece_cost: null,
              edging: null,
              cost: 750,
              linked_item_id: null,
            },
          ],
        },
      ],
      quote_revision_history: [],
    },
  ],
});

function fakeSupabase(quotes: unknown[], minMarginPct: number | null) {
  const settings = minMarginPct === null ? [] : [{ value: minMarginPct }];
  const quotesQuery = {
    data: quotes,
    error: null,
    eq: () => ({
      maybeSingle: async () => ({ data: quotes[0] ?? null, error: null }),
    }),
  };
  const from = vi.fn((table: string) =>
    table === "app_settings"
      ? {
          select: () => ({ eq: async () => ({ data: settings, error: null }) }),
        }
      : { select: () => quotesQuery },
  );
  vi.mocked(createClient).mockResolvedValue({
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return from;
}

beforeEach(() => {
  vi.mocked(seesMofCost).mockReset();
});

describe("loadQuote", () => {
  it("strips cost and margin for someone without the margin flag", async () => {
    fakeSupabase([quote(QUOTE_ID, "2026-11-01T00:00:00+00:00")], 30);
    vi.mocked(seesMofCost).mockResolvedValue(false);

    const view = await loadQuote(viewer, QUOTE_ID);

    expect(view?.costShown).toBe(false);
    const option = view?.revisions[0].options[0];
    expect(option).not.toHaveProperty("cost");
    expect(option).not.toHaveProperty("margin");
    expect(option?.items[0]).not.toHaveProperty("lumpCost");
    expect(option?.marginLevel).toBe("low");
  });

  it("keeps cost and margin for someone with the flag", async () => {
    fakeSupabase([quote(QUOTE_ID, "2026-11-01T00:00:00+00:00")], 30);
    vi.mocked(seesMofCost).mockResolvedValue(true);

    const view = await loadQuote(viewer, QUOTE_ID);

    if (!view?.costShown) throw new Error("expected the full view");
    expect(view.revisions[0].options[0].cost).toBe(750);
    expect(view.revisions[0].lowestMargin).toBe(0.25);
  });

  it("reads Low/High from the minimum margin setting", async () => {
    fakeSupabase([quote(QUOTE_ID, "2026-11-01T00:00:00+00:00")], 20);
    vi.mocked(seesMofCost).mockResolvedValue(false);

    const view = await loadQuote(viewer, QUOTE_ID);

    expect(view?.revisions[0].marginLevel).toBe("high");
  });

  it("falls back to 30% when the setting is missing", async () => {
    fakeSupabase([quote(QUOTE_ID, "2026-11-01T00:00:00+00:00")], null);
    vi.mocked(seesMofCost).mockResolvedValue(false);

    const view = await loadQuote(viewer, QUOTE_ID);

    expect(view?.revisions[0].marginLevel).toBe("low");
  });

  it("is null for an id that is not a quote id, without asking the database", async () => {
    const from = fakeSupabase([], 30);

    expect(await loadQuote(viewer, "NEW")).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("is null when the viewer cannot read the quote", async () => {
    fakeSupabase([], 30);
    vi.mocked(seesMofCost).mockResolvedValue(true);

    expect(await loadQuote(viewer, QUOTE_ID)).toBeNull();
  });
});

describe("loadQuoteRegister", () => {
  it("lists quotes most recently changed first, stripped without the flag", async () => {
    fakeSupabase(
      [
        quote("a", "2026-11-01T00:00:00+00:00"),
        quote("b", "2026-11-03T00:00:00+00:00"),
      ],
      30,
    );
    vi.mocked(seesMofCost).mockResolvedValue(false);

    const rows = await loadQuoteRegister(viewer);

    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({
      costShown: false,
      amount: 1000,
      marginLevel: "low",
      salespersonName: "Ah Kow",
    });
    expect(rows[0]).not.toHaveProperty("lowestMargin");
  });
});
