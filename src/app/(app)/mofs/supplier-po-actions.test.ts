import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveSupplierPo } from "./supplier-po-actions";

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
}));

const MOF = "33333333-3333-4333-8333-333333333333";
const PO = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Wai Mun",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { steps: string[]; payload: unknown; args: unknown[] };

/** The query answers with the given result; calls are recorded. */
function fakeSupabase(result: Result) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn(() => {
      const call: Call = { steps: [], payload: undefined, args: [] };
      calls.push(call);
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
          call.args.push(...args);
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

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    mofId: MOF,
    zohoNo: "2210",
    supplier: " Unijoy ",
    poDate: "2026-11-02",
    leadTimeDays: "21",
    status: "ordered",
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const saved: Result = { data: [{ id: PO }], error: null };

describe("saveSupplierPo", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
  });

  it("adds a PO to the MOF", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveSupplierPo(form());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["insert", "select"]);
    expect(calls[0]?.payload).toEqual({
      mof_id: MOF,
      zoho_no: "2210",
      supplier: "Unijoy",
      po_date: "2026-11-02",
      lead_time_days: 21,
      status: "ordered",
      notes: null,
    });
  });

  it("changes an existing PO without moving it to another MOF", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveSupplierPo(
      form({ poId: PO, status: "shipping", notes: "Vessel departed" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["update", "eq", "eq", "select"]);
    expect(calls[0]?.payload).toMatchObject({
      status: "shipping",
      notes: "Vessel departed",
    });
    expect(calls[0]?.payload).not.toHaveProperty("mof_id");
    expect(calls[0]?.args).toContain(PO);
  });

  it("refuses someone who cannot change the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const calls = fakeSupabase(saved);

    const result = await saveSupplierPo(form());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });

  it("asks for only the 4-digit running number", async () => {
    const calls = fakeSupabase(saved);

    const result = await saveSupplierPo(form({ zohoNo: "MOF-2611" }));

    expect(result.error).toMatch(/4-digit Zoho running no/);
    expect(calls).toHaveLength(0);
  });

  it("rejects a negative or fractional lead time", async () => {
    fakeSupabase(saved);

    expect((await saveSupplierPo(form({ leadTimeDays: "-1" }))).error).toMatch(
      /whole number of days/,
    );
    expect((await saveSupplierPo(form({ leadTimeDays: "2.5" }))).error).toMatch(
      /whole number of days/,
    );
  });

  it("rejects an unknown status", async () => {
    fakeSupabase(saved);

    const result = await saveSupplierPo(form({ status: "lost" }));

    expect(result.error).toBe("Choose the status.");
  });

  it("reports a running number already used", async () => {
    fakeSupabase({ data: null, error: { code: "23505" } });

    const result = await saveSupplierPo(form());

    expect(result.error).toMatch(/2210 is already used/);
  });

  it("reports a refusal from the database", async () => {
    fakeSupabase({ data: null, error: { code: "42501" } });

    const result = await saveSupplierPo(form());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
  });

  it("reports a PO that is gone", async () => {
    fakeSupabase({ data: [], error: null });

    const result = await saveSupplierPo(form({ poId: PO }));

    expect(result.error).toMatch(/Reload the page/);
  });
});
