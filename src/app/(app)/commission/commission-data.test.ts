import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { DEFAULT_COMMISSION_SETTINGS } from "@/lib/domain/commission-settings";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionLines } from "./commission-data";
import { loadCommissionSettings } from "./commission-settings-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/team-directory", () => ({ getTeamDirectory: vi.fn() }));
vi.mock("./commission-settings-data", () => ({
  loadCommissionSettings: vi.fn(),
}));

const SARAH = "55555555-5555-4555-8555-555555555555";
const KEN = "66666666-6666-4666-8666-666666666666";

const mof = (id: string, salespersonId: string) => ({
  id,
  mof_no: `MOF-${id}`,
  company_name: "Acme",
  project_name: "Lobby",
  loa_date: "2026-10-01",
  invoice_date: "2026-10-05",
  contract_sum: 100_000,
  vo_amount: 0,
  commission_type: "own",
  salesperson_id: salespersonId,
  second_salesperson_id: null,
  payments: [{ amount: 100_000, received_on: "2026-10-10" }],
  commission_payouts: [],
});

/** The database hands a salesperson only their own order in commission_basis, and no costs. */
function fakeSupabase() {
  const tables: string[] = [];
  const client = {
    from: vi.fn((table: string) => {
      tables.push(table);
      const query: Record<string, unknown> = {};
      query.select = () => query;
      query.neq = () => query;
      // Two orderings, as the loader asks; the last one resolves.
      let orders = 0;
      query.order = () => {
        orders += 1;
        return orders < 2
          ? query
          : Promise.resolve({
              data: [mof("a", SARAH), mof("b", KEN)],
              error: null,
            });
      };
      return query;
    }),
    rpc: vi.fn(async () => ({
      data: [
        {
          mof_id: "a",
          margin_tier: "high",
          salesperson_mode: "standard",
          second_salesperson_mode: null,
          passed_by_id: null,
          passed_by_mode: null,
        },
      ],
      error: null,
    })),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, tables };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getTeamDirectory).mockResolvedValue([
    { id: SARAH, name: "Sarah" },
    { id: KEN, name: "Ken" },
  ]);
  vi.mocked(loadCommissionSettings).mockResolvedValue(
    DEFAULT_COMMISSION_SETTINGS,
  );
});

describe("loadCommissionLines", () => {
  it("leaves out orders the database did not hand over a basis for", async () => {
    fakeSupabase();

    const lines = await loadCommissionLines();

    expect(lines.map((line) => line.mofId)).toEqual(["a"]);
  });

  it("works out the commission from the tier alone, never reading costs", async () => {
    const { client, tables } = fakeSupabase();

    const [line] = await loadCommissionLines();

    expect(client.rpc).toHaveBeenCalledWith("commission_basis");
    expect(tables).not.toContain("mof_costs");
    // RM 100,000 own effort at 3% plus the 1% high-margin extra, paid in full on time.
    expect(line).toMatchObject({
      tier: "high",
      personName: "Sarah",
      commission: { earned: 4_000, claimable: true },
      balance: { remaining: 4_000, payableNow: 4_000 },
    });
  });
});
