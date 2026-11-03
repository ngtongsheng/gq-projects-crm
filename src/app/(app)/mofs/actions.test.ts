import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveMof } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const SALES = "22222222-2222-4222-8222-222222222222";
const MOF = "33333333-3333-4333-8333-333333333333";
const LINE = "44444444-4444-4444-8444-444444444444";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Wai Mun",
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
type Call = {
  table: string;
  steps: string[];
  payload: unknown;
  args: unknown[];
};

/** Each query or rpc answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const next = () => results.shift() ?? { data: null, error: null };
  const client = {
    rpc: vi.fn((name: string, payload: unknown) => {
      calls.push({ table: `rpc:${name}`, steps: [], payload, args: [] });
      return Promise.resolve(next());
    }),
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined, args: [] };
      calls.push(call);
      const result = next();
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "delete",
        "eq",
        "not",
        "maybeSingle",
        "single",
      ]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
          call.args.push(...args);
          if (step === "insert" || step === "update") call.payload = args[0];
          if (step === "maybeSingle" || step === "single") {
            return Promise.resolve(result);
          }
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

const line = (overrides: Record<string, string> = {}) => ({
  id: "",
  product: "Carpet Tile",
  stockType: "indent",
  supplier: "Unijoy",
  qty: "1000",
  unit: "sqft",
  areaM2: "",
  ...overrides,
});

function form(
  fields: Record<string, string> = {},
  lines: ReturnType<typeof line>[] = [line()],
) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    mofNo: "mof-2611",
    loaDate: "2026-11-02",
    salespersonId: SALES,
    secondSalespersonId: "",
    projectId: "",
    companyName: "Lumen Interior Studio",
    projectName: "Corporate office, Bangsar",
    scope: "s_and_l",
    contractSum: "12,500",
    voAmount: "",
    retentionPct: "5",
    commissionType: "own",
    stage: "pending_order",
    paymentChecked: "on",
    lines: JSON.stringify(lines),
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const saved: Result = { data: MOF, error: null };
const existing = (contractSum = 12500, voAmount = 0): Result => ({
  data: { contract_sum: contractSum, vo_amount: voAmount },
  error: null,
});
const refused = (message = ""): Result => ({
  data: null,
  error: { code: "42501", message },
});

type SavePayload = {
  mof_id: string | null;
  mof: Record<string, unknown>;
  lines: Record<string, unknown>[];
  reason: string;
  cost: number | null;
};

/** The one save_mof call; there must be exactly one. */
function savePayload(calls: Call[]): SavePayload {
  const saves = calls.filter((call) => call.table === "rpc:save_mof");
  expect(saves).toHaveLength(1);
  return saves[0]?.payload as SavePayload;
}

describe("saveMof: register a new MOF", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("registers the MOF with its lines in m2 in one call", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([saved]);

    const result = await saveMof(form());

    expect(result).toEqual({ error: null, mofId: MOF });
    expect(calls).toHaveLength(1);
    const payload = savePayload(calls);
    expect(payload.mof_id).toBeNull();
    expect(payload.mof).toMatchObject({
      mof_no: "MOF-2611",
      salesperson_id: SALES,
      contract_sum: 12500,
      vo_amount: 0,
      retention_pct: 5,
      payment_checked: true,
      approvals_in_writing: false,
    });
    expect(payload.lines).toEqual([
      {
        id: null,
        product: "Carpet Tile",
        stock_type: "indent",
        supplier: "Unijoy",
        qty: 1000,
        unit: "sqft",
        area_m2: 92.9,
      },
    ]);
    expect(payload.cost).toBeNull();
  });

  it("refuses a salesperson", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveMof(form());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });

  it("lets HR & Accounts set the cost", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase([saved]);

    const result = await saveMof(form({ cost: "RM 8,000" }));

    expect(result.error).toBeNull();
    expect(savePayload(calls).cost).toBe(8000);
  });

  it("reports a MOF number already registered", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase([
      { data: null, error: { code: "23505", message: "mofs_mof_no_key" } },
    ]);

    const result = await saveMof(form());

    expect(result.error).toMatch(/already registered/);
  });

  it("asks to try again when the save fails part-way", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase([
      { data: null, error: { code: "23514", message: "mof_lines_check" } },
    ]);

    const result = await saveMof(form());

    expect(result.error).toBe("Could not save the MOF. Try again.");
  });
});

describe("saveMof: cost is for managers only", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it.each([
    ["Purchasing", "support"],
    ["a salesperson", "sales"],
  ] as const)("refuses a cost from %s before writing anything", async (_label, jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = fakeSupabase([]);

    const result = await saveMof(form({ mofId: MOF, cost: "8000" }));

    expect(result.error).toMatch(/Only the/);
    expect(calls).toHaveLength(0);
  });

  it("reports the database refusing a cost", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase([
      existing(),
      refused(
        'new row violates row-level security policy for table "mof_costs"',
      ),
    ]);

    const result = await saveMof(form({ mofId: MOF, cost: "8000" }));

    expect(result.error).toMatch(/cost/);
  });

  it("leaves the cost alone when it is blank", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase([existing(), saved]);

    const result = await saveMof(form({ mofId: MOF, cost: "" }));

    expect(result.error).toBeNull();
    expect(savePayload(calls).cost).toBeNull();
  });
});

describe("saveMof: order total", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
  });

  it("refuses a change in order total without a reason", async () => {
    const calls = fakeSupabase([existing()]);

    const result = await saveMof(
      form({ mofId: MOF, voAmount: "-400", reason: "  " }),
    );

    expect(result.error).toMatch(/reason/);
    expect(calls).toHaveLength(1);
  });

  it("sends the new total with the reason", async () => {
    const calls = fakeSupabase([existing(), saved]);

    const result = await saveMof(
      form({
        mofId: MOF,
        voAmount: "-400",
        reason: " CN-0412: 40 m² returned ",
      }),
    );

    expect(result.error).toBeNull();
    expect(savePayload(calls)).toMatchObject({
      mof_id: MOF,
      mof: { contract_sum: 12500, vo_amount: -400 },
      reason: "CN-0412: 40 m² returned",
    });
  });

  it("needs no reason when the total is unchanged", async () => {
    const calls = fakeSupabase([existing(), saved]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toBeNull();
    expect(savePayload(calls).reason).toBe("");
  });
});

describe("saveMof: product lines", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
  });

  it("marks kept lines by id and new ones without", async () => {
    const calls = fakeSupabase([existing(), saved]);

    const result = await saveMof(
      form({ mofId: MOF }, [
        line({ id: LINE, qty: "250", unit: "m2" }),
        line({
          product: "Carpet Roll",
          unit: "roll",
          qty: "3",
          areaM2: "120.5",
        }),
      ]),
    );

    expect(result.error).toBeNull();
    expect(savePayload(calls).lines).toEqual([
      expect.objectContaining({ id: LINE, qty: 250, area_m2: 250 }),
      expect.objectContaining({ id: null, unit: "roll", area_m2: 120.5 }),
    ]);
  });

  it.each([
    ["no lines", [], /at least one product line/],
    ["a blank product", [line({ product: " " })], /product/],
    ["a negative quantity", [line({ qty: "-1" })], /negative/],
    ["an unknown unit", [line({ unit: "box" })], /./],
  ])("refuses %s", async (_label, lines, message) => {
    const calls = fakeSupabase([]);

    const result = await saveMof(form({}, lines));

    expect(result.error).toMatch(message);
    expect(calls).toHaveLength(0);
  });

  it("refuses lines that are not a list of rows", async () => {
    const calls = fakeSupabase([]);
    const data = form();
    data.set("lines", "not json");

    const result = await saveMof(data);

    expect(result.error).toMatch(/product lines/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a saved line id on a new MOF", async () => {
    const calls = fakeSupabase([]);

    const result = await saveMof(form({}, [line({ id: LINE })]));

    expect(result.error).toMatch(/Reload/);
    expect(calls).toHaveLength(0);
  });
});

describe("saveMof: existing MOF", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
  });

  it("reports a MOF that is gone", async () => {
    fakeSupabase([{ data: null, error: null }]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toMatch(/Reload/);
  });

  it("reports a MOF removed while saving", async () => {
    fakeSupabase([existing(), { data: null, error: { code: "P0002" } }]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toMatch(/Reload/);
  });

  it("reports a change the database refused", async () => {
    fakeSupabase([existing(), refused()]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
  });
});
