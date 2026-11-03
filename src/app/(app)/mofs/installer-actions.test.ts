import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  recordInstallerPayment,
  saveInstallerClaim,
  saveInstallerPo,
  verifyInstallerClaim,
} from "./installer-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const MOF = "33333333-3333-4333-8333-333333333333";
const PO = "66666666-6666-4666-8666-666666666666";
const CLAIM = "77777777-7777-4777-8777-777777777777";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Awal",
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
type Call = { table: string; steps: string[]; payload: unknown };

/** Each query takes the next result in line; calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "neq", "select"]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
          if (step === "insert" || step === "update") call.payload = args[0];
          return Object.assign(Promise.resolve(result), query);
        };
      }
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const poForm = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    poNo: "IPO-0398",
    poDate: "2026-11-02",
    installer: " Ilham ",
    amount: "RM 45,000",
    scope: "",
    retentionPct: "5",
    ...fields,
  });

const claimForm = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    installerPoId: PO,
    type: "progress",
    claimNo: "IL-031",
    amount: "30000",
    claimedOn: "2026-11-02",
    ...fields,
  });

const saved: Result = { data: [{ id: PO }], error: null };
const poAmount = (amount: number): Result => ({
  data: [{ amount }],
  error: null,
});
const existingClaims = (...amounts: number[]): Result => ({
  data: amounts.map((amount, i) => ({
    id: `0000000${i}-0000-4000-8000-000000000000`,
    claim_type: "progress",
    amount,
  })),
  error: null,
});

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("saveInstallerPo", () => {
  it("adds a PO with the amount in ringgit", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveInstallerPo(poForm());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["insert", "select"]);
    expect(calls[0]?.payload).toEqual({
      mof_id: MOF,
      po_no: "IPO-0398",
      po_date: "2026-11-02",
      installer: "Ilham",
      amount: 45000,
      scope: null,
      retention_pct: 5,
    });
  });

  it("changes a PO without moving it to another MOF", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveInstallerPo(poForm({ poId: PO }));

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["update", "eq", "eq", "select"]);
    expect(calls[0]?.payload).not.toHaveProperty("mof_id");
  });

  it("refuses someone who cannot change the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase(saved);

    const result = await saveInstallerPo(poForm());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });

  it("rejects a zero amount and a retention over 100%", async () => {
    fakeSupabase(saved);

    expect((await saveInstallerPo(poForm({ amount: "0" }))).error).toMatch(
      /PO amount/,
    );
    expect(
      (await saveInstallerPo(poForm({ retentionPct: "101" }))).error,
    ).toMatch(/cannot be more than 100%/);
  });

  it("reports an installer already on the MOF", async () => {
    fakeSupabase({ data: null, error: { code: "23505" } });

    const result = await saveInstallerPo(poForm());

    expect(result.error).toMatch(/Ilham already has an installer PO/);
  });
});

describe("saveInstallerClaim", () => {
  it("adds a claim within the PO amount", async () => {
    const calls = fakeSupabase(poAmount(45000), existingClaims(), saved);

    const result = await saveInstallerClaim(claimForm());

    expect(result).toEqual({ error: null });
    expect(calls[2]?.payload).toEqual({
      installer_po_id: PO,
      claim_type: "progress",
      claim_no: "IL-031",
      amount: 30000,
      claimed_on: "2026-11-02",
    });
  });

  it("refuses a claim that takes the total past the PO", async () => {
    const calls = fakeSupabase(poAmount(45000), existingClaims(30000));

    const result = await saveInstallerClaim(claimForm({ amount: "15000.01" }));

    expect(result.error).toMatch(/more than the installer PO of RM 45,000.00/);
    expect(calls.map((call) => call.table)).not.toContain("insert");
    expect(calls.every((call) => !call.steps.includes("insert"))).toBe(true);
  });

  it("explains when the database finds the PO already used up", async () => {
    const overPo =
      "These claims add up to more than the installer PO. If there is extra work, increase the PO amount first.";
    // Another claim was saved between the check and this write.
    fakeSupabase(poAmount(45000), existingClaims(), {
      data: null,
      error: { code: "23514", message: overPo },
    });

    const result = await saveInstallerClaim(claimForm());

    expect(result).toEqual({ error: overPo });
  });

  it("takes a deduction without checking the PO amount", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveInstallerClaim(
      claimForm({ type: "deduction", amount: "800" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls).toHaveLength(1);
  });

  it("does not count the claim being edited against itself", async () => {
    fakeSupabase(poAmount(1000), existingClaims(600), saved);

    const result = await saveInstallerClaim(
      claimForm({
        claimId: "00000000-0000-4000-8000-000000000000",
        amount: "1000",
      }),
    );

    expect(result).toEqual({ error: null });
  });

  it("refuses someone who cannot change the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase(saved);

    const result = await saveInstallerClaim(claimForm());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });

  it("reports a PO that is gone", async () => {
    fakeSupabase({ data: [], error: null }, existingClaims());

    const result = await saveInstallerClaim(claimForm());

    expect(result.error).toMatch(/Reload the page/);
  });
});

describe("verifyInstallerClaim", () => {
  it("lets a site supervisor verify as themselves", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: [{ id: CLAIM }], error: null });

    const result = await verifyInstallerClaim(MOF, CLAIM);

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toMatchObject({ verified_by: ME });
  });

  it("refuses Purchasing and Sales", async () => {
    for (const role of ["support", "sales"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await verifyInstallerClaim(MOF, CLAIM);

      expect(result.error).toMatch(/Only a Site Supervisor/);
      expect(calls).toHaveLength(0);
    }
  });

  it("reports a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ data: null, error: { code: "42501" } });

    const result = await verifyInstallerClaim(MOF, CLAIM);

    expect(result.error).toMatch(/Only a Site Supervisor/);
  });
});

describe("recordInstallerPayment", () => {
  const payForm = (fields: Record<string, string> = {}) =>
    form({
      mofId: MOF,
      claimId: CLAIM,
      paidAmount: "28,500",
      paidOn: "2026-11-02",
      ...fields,
    });

  it("lets HR & Accounts record a payment", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase({ data: [{ id: CLAIM }], error: null });

    const result = await recordInstallerPayment(payForm());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({
      paid_amount: 28500,
      paid_on: "2026-11-02",
    });
  });

  it("refuses Purchasing and Sales", async () => {
    for (const role of ["support", "sales"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await recordInstallerPayment(payForm());

      expect(result.error).toMatch(/Only the MD or HR & Accounts/);
      expect(calls).toHaveLength(0);
    }
  });

  it("explains that unverified work cannot be paid", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase({
      data: null,
      error: {
        code: "23514",
        message: "The site supervisor must verify the work before payment.",
      },
    });

    const result = await recordInstallerPayment(payForm());

    expect(result.error).toMatch(/must verify the work/);
  });

  it("rejects a missing amount", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase();

    const result = await recordInstallerPayment(payForm({ paidAmount: "" }));

    expect(result.error).toMatch(/amount paid/);
  });
});
