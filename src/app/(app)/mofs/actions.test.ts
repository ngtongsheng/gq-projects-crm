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

const ok: Result = { data: null, error: null };
const inserted: Result = { data: { id: MOF }, error: null };
const existing = (contractSum = 12500, voAmount = 0): Result => ({
  data: { contract_sum: contractSum, vo_amount: voAmount },
  error: null,
});
const updated: Result = { data: [{ id: MOF }], error: null };
const noRows: Result = { data: [], error: null };
const refused: Result = { data: null, error: { code: "42501" } };

const tables = (calls: Call[]) => calls.map((call) => call.table);

describe("saveMof: register a new MOF", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("registers the MOF with its lines in m2", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([inserted, ok, ok]);

    const result = await saveMof(form());

    expect(result).toEqual({ error: null, mofId: MOF });
    expect(calls[0]?.payload).toMatchObject({
      mof_no: "MOF-2611",
      salesperson_id: SALES,
      contract_sum: 12500,
      vo_amount: 0,
      retention_pct: 5,
      payment_checked: true,
      approvals_in_writing: false,
    });
    expect(calls[2]?.payload).toEqual([
      {
        mof_id: MOF,
        product: "Carpet Tile",
        stock_type: "indent",
        supplier: "Unijoy",
        qty: 1000,
        unit: "sqft",
        area_m2: 92.9,
      },
    ]);
    expect(tables(calls)).not.toContain("mof_costs");
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
    const calls = fakeSupabase([inserted, ok, ok, noRows, ok]);

    const result = await saveMof(form({ cost: "RM 8,000" }));

    expect(result.error).toBeNull();
    expect(calls[4]).toMatchObject({
      table: "mof_costs",
      payload: { mof_id: MOF, cost: 8000 },
    });
  });

  it("reports a MOF number already registered", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    fakeSupabase([
      { data: null, error: { code: "23505", message: "mofs_mof_no_key" } },
    ]);

    const result = await saveMof(form());

    expect(result.error).toMatch(/already registered/);
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
    fakeSupabase([existing(), updated, ok, ok, noRows, refused]);

    const result = await saveMof(form({ mofId: MOF, cost: "8000" }));

    expect(result.error).toMatch(/cost/);
  });

  it("leaves the cost alone when it is blank", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase([existing(), updated, ok, ok]);

    const result = await saveMof(form({ mofId: MOF, cost: "" }));

    expect(result.error).toBeNull();
    expect(tables(calls)).not.toContain("mof_costs");
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

  it("changes the total through update_mof_total with the reason", async () => {
    const calls = fakeSupabase([existing(), updated, ok, ok, ok]);

    const result = await saveMof(
      form({
        mofId: MOF,
        voAmount: "-400",
        reason: " CN-0412: 40 m² returned ",
      }),
    );

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).not.toHaveProperty("contract_sum");
    expect(calls[1]?.payload).not.toHaveProperty("vo_amount");
    expect(calls[4]).toMatchObject({
      table: "rpc:update_mof_total",
      payload: {
        mof_id: MOF,
        contract_sum: 12500,
        vo_amount: -400,
        reason: "CN-0412: 40 m² returned",
      },
    });
  });

  it("needs no reason when the total is unchanged", async () => {
    const calls = fakeSupabase([existing(), updated, ok, ok]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toBeNull();
    expect(tables(calls)).not.toContain("rpc:update_mof_total");
  });
});

describe("saveMof: product lines", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
  });

  it("removes dropped lines, changes kept ones and adds new ones", async () => {
    const calls = fakeSupabase([existing(), updated, ok, ok, ok]);

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
    expect(calls[2]).toMatchObject({ table: "mof_lines" });
    expect(calls[2]?.steps).toEqual(["delete", "eq", "not"]);
    expect(calls[2]?.args).toContain(`(${LINE})`);
    expect(calls[3]?.payload).toMatchObject({ qty: 250, area_m2: 250 });
    expect(calls[3]?.args).toEqual(
      expect.arrayContaining(["id", LINE, "mof_id", MOF]),
    );
    expect(calls[4]?.payload).toEqual([
      expect.objectContaining({ mof_id: MOF, unit: "roll", area_m2: 120.5 }),
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

  it("reports a change the database refused", async () => {
    fakeSupabase([existing(), noRows]);

    const result = await saveMof(form({ mofId: MOF }));

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
  });
});
