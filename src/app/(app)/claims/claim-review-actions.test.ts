import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import type { ClaimStatus } from "@/lib/domain/claim-flow";
import { createClient } from "@/lib/supabase/server";
import { saveClaimReview, waiveLateCut } from "./claim-review-actions";

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

const CLAIM = "33333333-3333-4333-8333-333333333333";
const SARAH = "55555555-5555-4555-8555-555555555555";
const MEI = "11111111-1111-4111-8111-111111111111";
const EXPENSE = "44444444-4444-4444-8444-444444444444";
const MOF = "66666666-6666-4666-8666-666666666666";

const profile = (jobRole: Profile["jobRole"], id = MEI): Profile => ({
  id,
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

type World = {
  status: ClaimStatus;
  remark: string;
  received: boolean;
  appealApproved: boolean;
  lateCut: number;
};

const writes: { table: string; values: Record<string, unknown> }[] = [];

function given(me: Profile, overrides: Partial<World> = {}) {
  const world: World = {
    status: "submitted",
    remark: "",
    received: false,
    appealApproved: true,
    lateCut: 40,
    ...overrides,
  };
  vi.mocked(getCurrentProfile).mockResolvedValue(me);
  const query = (table: string) => {
    let update: Record<string, unknown> | null = null;
    const result = () => {
      if (update) {
        writes.push({ table, values: update });
        return { data: [{ claim_id: CLAIM, id: CLAIM }], error: null };
      }
      switch (table) {
        case "monthly_claims":
          return {
            data: {
              id: CLAIM,
              profile_id: SARAH,
              status: world.status,
              remark: world.remark,
              original_receipts_received: world.received,
              ot_original_amount: "50.00",
              ot_amount: "50.00",
            },
            error: null,
          };
        case "monthly_claim_expenses":
          return {
            data: [{ key: EXPENSE, amount: "30.00", original_amount: "30.00" }],
            error: null,
          };
        case "monthly_claim_commissions":
          return {
            data: [
              { key: MOF, amount: "100.00", original_amount: "100.00" },
            ].map((row) => ({
              ...row,
              mof_id: MOF,
              profile_id: SARAH,
              late_cut_amount: String(world.lateCut),
            })),
            error: null,
          };
        case "commission_appeals":
          return {
            data: world.appealApproved ? [{ id: "a" }] : [],
            error: null,
          };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    };
    const builder = Object.assign(Promise.resolve().then(result), {
      select: () => builder,
      update: (values: Record<string, unknown>) => {
        update = values;
        return builder;
      },
      eq: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        const found = result();
        return Promise.resolve({
          ...found,
          data: Array.isArray(found.data) ? found.data[0] : found.data,
        });
      },
    });
    return builder;
  };
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn(query),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

const input = (
  overrides: Partial<Parameters<typeof saveClaimReview>[1]> = {},
) => ({
  lines: [],
  reason: "",
  remark: "",
  originalReceiptsReceived: false,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
});

describe("saveClaimReview", () => {
  it("changes an expense amount with the reason and keeps the rest", async () => {
    given(profile("accounts"));
    const result = await saveClaimReview(
      CLAIM,
      input({
        lines: [{ kind: "expense", id: EXPENSE, amount: 20 }],
        reason: "Personal parking",
      }),
    );
    expect(result).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "monthly_claim_expenses",
        values: { amount: 20, adjustment_reason: "Personal parking" },
      },
    ]);
  });

  it("needs a reason for any changed amount and writes nothing without one", async () => {
    given(profile("md"));
    const result = await saveClaimReview(
      CLAIM,
      input({ lines: [{ kind: "commission", id: MOF, amount: 80 }] }),
    );
    expect(result.error).toMatch(/reason/);
    expect(writes).toEqual([]);
  });

  it("saves the remark, the receipts tick and an OT amount with its reason on the claim", async () => {
    given(profile("accounts"));
    const result = await saveClaimReview(
      CLAIM,
      input({
        lines: [{ kind: "ot", id: CLAIM, amount: 60 }],
        reason: "Rate corrected",
        remark: "Client visit confirmed",
        originalReceiptsReceived: true,
      }),
    );
    expect(result).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "monthly_claims",
        values: {
          remark: "Client visit confirmed",
          original_receipts_received: true,
          ot_amount: 60,
          ot_adjustment_reason: "Rate corrected",
        },
      },
    ]);
  });

  it("is refused for other roles, once approved and on the checker's own claim", async () => {
    given(profile("director"));
    expect((await saveClaimReview(CLAIM, input())).error).toMatch(/Only HR/);
    given(profile("accounts"), { status: "approved" });
    expect((await saveClaimReview(CLAIM, input())).error).toMatch(/Only HR/);
    given(profile("accounts", SARAH));
    expect((await saveClaimReview(CLAIM, input())).error).toMatch(/Only HR/);
    expect(writes).toEqual([]);
  });
});

describe("waiveLateCut", () => {
  it("gives back the cut once a special approval exists", async () => {
    given(profile("accounts"));
    expect(await waiveLateCut(CLAIM, MOF)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        table: "monthly_claim_commissions",
        values: {
          amount: 140,
          adjustment_reason: "Late-collection cut waived (special approval)",
        },
      },
    ]);
  });

  it("is refused without an approved appeal or a cut to give back", async () => {
    given(profile("accounts"), { appealApproved: false });
    expect((await waiveLateCut(CLAIM, MOF)).error).toMatch(/special approval/);
    given(profile("accounts"), { lateCut: 0 });
    expect((await waiveLateCut(CLAIM, MOF)).error).toMatch(
      /no late-collection cut/,
    );
    expect(writes).toEqual([]);
  });
});
