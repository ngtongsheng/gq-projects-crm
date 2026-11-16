import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import type { ClaimStatus } from "@/lib/domain/claim-flow";
import { createClient } from "@/lib/supabase/server";
import { loadReportFilers } from "../reports/report-filers";
import {
  approveClaim,
  checkClaim,
  payClaim,
  returnClaim,
  submitClaim,
} from "./actions";
import { loadClaimFlagCount } from "./claim-review-flags";
import { loadClaimSettings } from "./claim-settings-data";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("../reports/report-filers", () => ({ loadReportFilers: vi.fn() }));
vi.mock("./claim-settings-data", () => ({ loadClaimSettings: vi.fn() }));
vi.mock("./claim-review-flags", () => ({ loadClaimFlagCount: vi.fn() }));
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

type DbError = { code?: string; message: string } | null;

/** What the fake database holds for this test. */
type World = {
  status: ClaimStatus;
  receiptsReceived: boolean;
  remark: string;
  receipts: number;
  commissions: number;
  expenses: number;
  ot: number;
  joinedOn: string | null;
  /** monthly_reports status by month. */
  reports: Record<string, string>;
  updateError: DbError;
  /** False when someone else moved the claim on meanwhile, so the update matches nothing. */
  updateMatches: boolean;
  rpcError: DbError;
};

const calls: {
  updates: Record<string, unknown>[];
  rpcs: { name: string; args: unknown }[];
} = { updates: [], rpcs: [] };

function fakeSupabase(world: World) {
  const query = (table: string) => {
    const filters: Record<string, unknown> = {};
    let update: Record<string, unknown> | null = null;
    let withReceipt = false;
    const result = () => {
      if (update) {
        calls.updates.push(update);
        return world.updateError
          ? { data: null, error: world.updateError }
          : { data: world.updateMatches ? [{ id: CLAIM }] : [], error: null };
      }
      switch (table) {
        case "monthly_claims":
          return {
            data: {
              id: CLAIM,
              profile_id: SARAH,
              month: "2026-11-01",
              status: world.status,
              original_receipts_received: world.receiptsReceived,
              remark: world.remark,
            },
            error: null,
          };
        case "monthly_claim_commissions":
          return { count: world.commissions, error: null };
        case "monthly_claim_expenses":
          return {
            count: withReceipt ? world.receipts : world.expenses,
            error: null,
          };
        case "profiles":
          return { data: { joined_on: world.joinedOn }, error: null };
        case "monthly_reports": {
          const status = world.reports[String(filters.month)];
          return { data: status ? { status } : null, error: null };
        }
        default:
          throw new Error(`unexpected table ${table}`);
      }
    };
    // Awaiting the builder runs the query, after the chained calls have set it up.
    const builder = Object.assign(Promise.resolve().then(result), {
      select: () => builder,
      update: (values: Record<string, unknown>) => {
        update = values;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      },
      not: () => {
        withReceipt = true;
        return builder;
      },
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
    });
    return builder;
  };
  const client = {
    from: vi.fn(query),
    rpc: vi.fn((name: string, args: unknown) => {
      calls.rpcs.push({ name, args });
      if (name === "monthly_claim_ot_amount")
        return Promise.resolve({ data: world.ot, error: null });
      return Promise.resolve({ data: null, error: world.rpcError });
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

function given(me: Profile, overrides: Partial<World> = {}): void {
  vi.mocked(getCurrentProfile).mockResolvedValue(me);
  fakeSupabase({
    status: "draft",
    receiptsReceived: false,
    remark: "",
    receipts: 0,
    commissions: 0,
    expenses: 1,
    ot: 0,
    joinedOn: "2024-01-01",
    reports: { "2026-10-01": "submitted" },
    updateError: null,
    updateMatches: true,
    rpcError: null,
    ...overrides,
  });
}

const sarah = (jobRole: Profile["jobRole"] = "sales") =>
  profile(jobRole, SARAH);

beforeEach(() => {
  vi.resetAllMocks();
  calls.updates = [];
  calls.rpcs = [];
  vi.mocked(loadClaimSettings).mockResolvedValue({
    cutOffDay: 25,
    mileageRatePerKm: 0.6,
    kmPerDay: 150,
    monthlyTravelLimit: 0,
    needReport: true,
  });
  vi.mocked(loadClaimFlagCount).mockResolvedValue(0);
  vi.mocked(loadReportFilers).mockResolvedValue([
    { id: SARAH, name: "Sarah", kind: "sales" },
  ]);
});

describe("submit", () => {
  it("submits the person's own draft, freezing the month's OT", async () => {
    given(sarah(), { ot: 56.25 });
    expect(await submitClaim(CLAIM)).toMatchObject({ error: null });
    expect(calls.updates).toEqual([
      { status: "submitted", ot_original_amount: 56.25 },
    ]);
  });

  it("submits a returned claim again", async () => {
    given(sarah(), { status: "returned" });
    expect((await submitClaim(CLAIM)).error).toBeNull();
  });

  it("is refused for someone else's claim, even the MD's", async () => {
    given(profile("md"));
    expect((await submitClaim(CLAIM)).error).toMatch(/Only the person/);
    expect(calls.updates).toEqual([]);
  });

  it("is blocked until last month's report is submitted", async () => {
    given(sarah(), { reports: {} });
    expect((await submitClaim(CLAIM)).error).toBe(
      "Please submit your Oct 2026 monthly report first.",
    );
    given(sarah(), { reports: { "2026-10-01": "draft" } });
    expect((await submitClaim(CLAIM)).error).toMatch(/Oct 2026/);
    expect(calls.updates).toEqual([]);
  });

  it("is not blocked for someone who files no report", async () => {
    given(sarah("director"), { reports: {} });
    expect((await submitClaim(CLAIM)).error).toBeNull();
  });

  it("is not blocked when the setting is off", async () => {
    vi.mocked(loadClaimSettings).mockResolvedValue({
      cutOffDay: 25,
      mileageRatePerKm: 0.6,
      kmPerDay: 150,
      monthlyTravelLimit: 0,
      needReport: false,
    });
    given(sarah(), { reports: {} });
    expect((await submitClaim(CLAIM)).error).toBeNull();
  });

  it("refuses an empty claim", async () => {
    given(sarah(), { expenses: 0 });
    expect((await submitClaim(CLAIM)).error).toMatch(/Nothing to claim yet/);
    expect(calls.updates).toEqual([]);
  });

  it("explains a commission line already waiting in another claim", async () => {
    given(sarah(), {
      updateError: { code: "23505", message: "duplicate key" },
    });
    expect((await submitClaim(CLAIM)).error).toMatch(
      /already in another claim/,
    );
  });
});

describe("check", () => {
  it("HR & Accounts checks a submitted claim", async () => {
    given(profile("accounts"), { status: "submitted" });
    expect(await checkClaim(CLAIM)).toEqual({ error: null });
    expect(calls.updates).toEqual([{ status: "checked" }]);
  });

  it("is refused for the MD, other roles and HR & Accounts' own claim", async () => {
    for (const me of [profile("md"), profile("director"), sarah("accounts")]) {
      given(me, { status: "submitted" });
      expect((await checkClaim(CLAIM)).error).toMatch(/Only HR & Accounts/);
    }
    expect(calls.updates).toEqual([]);
  });

  it("needs the original receipts first", async () => {
    given(profile("accounts"), { status: "submitted", receipts: 2 });
    expect((await checkClaim(CLAIM)).error).toMatch(/Original receipts/);
    given(profile("accounts"), {
      status: "submitted",
      receipts: 2,
      receiptsReceived: true,
    });
    expect((await checkClaim(CLAIM)).error).toBeNull();
  });
});

describe("a flagged claim", () => {
  it("is not checked or approved until the checker has written a remark", async () => {
    vi.mocked(loadClaimFlagCount).mockResolvedValue(2);
    given(profile("accounts"), { status: "submitted" });
    expect((await checkClaim(CLAIM)).error).toMatch(/Write in the remark/);
    given(profile("md"), { status: "checked" });
    expect((await approveClaim(CLAIM)).error).toMatch(/Write in the remark/);
    expect(calls.updates).toEqual([]);
    expect(calls.rpcs).toEqual([]);
  });

  it("goes on once there is a remark", async () => {
    vi.mocked(loadClaimFlagCount).mockResolvedValue(2);
    given(profile("accounts"), { status: "submitted", remark: "Client visit" });
    expect(await checkClaim(CLAIM)).toEqual({ error: null });
    given(profile("md"), { status: "checked", remark: "Client visit" });
    expect(await approveClaim(CLAIM)).toEqual({ error: null });
  });
});

describe("approve", () => {
  it("the MD approves a submitted or checked claim through the database step", async () => {
    for (const status of ["submitted", "checked"] as const) {
      given(profile("md"), { status, receipts: 1 });
      expect(await approveClaim(CLAIM)).toEqual({ error: null });
    }
    expect(calls.rpcs).toEqual([
      { name: "approve_monthly_claim", args: { claim: CLAIM } },
      { name: "approve_monthly_claim", args: { claim: CLAIM } },
    ]);
  });

  it("HR & Accounts approves once the original receipts are in", async () => {
    given(profile("accounts"), { status: "checked", receipts: 1 });
    expect((await approveClaim(CLAIM)).error).toMatch(/Original receipts/);
    given(profile("accounts"), {
      status: "checked",
      receipts: 1,
      receiptsReceived: true,
    });
    expect((await approveClaim(CLAIM)).error).toBeNull();
  });

  it("an approver cannot approve their own claim", async () => {
    for (const jobRole of ["md", "accounts"] as const) {
      given(sarah(jobRole), { status: "submitted" });
      expect((await approveClaim(CLAIM)).error).toMatch(/never their own/);
    }
    expect(calls.rpcs).toEqual([]);
  });

  it("is refused for other roles and claims not waiting for approval", async () => {
    given(profile("director"), { status: "submitted" });
    expect((await approveClaim(CLAIM)).error).toMatch(
      /Only HR & Accounts or the MD/,
    );
    given(profile("md"), { status: "approved" });
    expect((await approveClaim(CLAIM)).error).toMatch(
      /Only HR & Accounts or the MD/,
    );
    expect(calls.rpcs).toEqual([]);
  });

  it("passes on the payout cap's message", async () => {
    given(profile("md"), {
      status: "submitted",
      rpcError: {
        code: "23514",
        message: "That is more than the RM 200.00 left to pay out.",
      },
    });
    expect((await approveClaim(CLAIM)).error).toBe(
      "That is more than the RM 200.00 left to pay out. Adjust that commission line, then approve.",
    );
  });
});

describe("return", () => {
  it("sends a submitted or checked claim back with what to fix", async () => {
    given(profile("md"), { status: "checked" });
    expect(await returnClaim(CLAIM, "  Toll receipt 12 Nov missing ")).toEqual({
      error: null,
    });
    expect(calls.updates).toEqual([
      { status: "returned", return_reason: "Toll receipt 12 Nov missing" },
    ]);
  });

  it("needs a reason", async () => {
    given(profile("accounts"), { status: "submitted" });
    expect((await returnClaim(CLAIM, "  ")).error).toBe("Say what to fix.");
  });

  it("is refused once approved, and for the person themselves", async () => {
    given(profile("accounts"), { status: "approved" });
    expect((await returnClaim(CLAIM, "Fix it")).error).toMatch(/Only/);
    given(sarah(), { status: "submitted" });
    expect((await returnClaim(CLAIM, "Fix it")).error).toMatch(/Only/);
    expect(calls.updates).toEqual([]);
  });
});

describe("pay", () => {
  it("HR & Accounts pays once the claim month's report is approved by the MD", async () => {
    given(profile("accounts"), {
      status: "approved",
      reports: { "2026-11-01": "approved" },
    });
    expect(await payClaim(CLAIM)).toEqual({ error: null });
    expect(calls.updates).toEqual([{ status: "paid" }]);
  });

  it("holds payment while the report is only reviewed", async () => {
    given(profile("accounts"), {
      status: "approved",
      reports: { "2026-11-01": "reviewed" },
    });
    expect((await payClaim(CLAIM)).error).toMatch(
      /Nov 2026 monthly report is approved by the MD/,
    );
    expect(calls.updates).toEqual([]);
  });

  it("pays someone who files no report", async () => {
    vi.mocked(loadClaimFlagCount).mockResolvedValue(0);
    vi.mocked(loadReportFilers).mockResolvedValue([]);
    given(profile("accounts"), { status: "approved", reports: {} });
    expect((await payClaim(CLAIM)).error).toBeNull();
  });

  it("is refused for the MD and before approval", async () => {
    given(profile("md"), { status: "approved" });
    expect((await payClaim(CLAIM)).error).toMatch(/Only HR & Accounts/);
    given(profile("accounts"), { status: "checked" });
    expect((await payClaim(CLAIM)).error).toMatch(/Only HR & Accounts/);
  });
});

it("tells the checker to reload when the claim moved on meanwhile", async () => {
  given(profile("accounts"), { status: "submitted", updateMatches: false });
  expect((await checkClaim(CLAIM)).error).toMatch(/moved on/);
});
