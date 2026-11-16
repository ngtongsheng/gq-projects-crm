import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { cancelDo, saveDoLines, setNextDoNumber } from "./do-actions";

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
const JOB = "66666666-6666-4666-8666-666666666666";

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
  language: "en",
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { name: string; steps: string[]; payload: unknown };

/** Each query or function call takes the next result in line; calls are recorded in order. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const next = () => queue.shift() ?? { data: [], error: null };
  const client = {
    rpc: vi.fn((name: string, args: unknown) => {
      calls.push({ name: `rpc:${name}`, steps: [], payload: args });
      return Promise.resolve(next());
    }),
    from: vi.fn((table: string) => {
      const call: Call = { name: table, steps: [], payload: undefined };
      calls.push(call);
      const result = next();
      const query: Record<string, unknown> = {};
      for (const step of ["update", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
          if (step === "update") call.payload = args[0];
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

const found: Result = { data: [{ id: "do" }], error: null };
const ok: Result = { data: null, error: null };

const row = (fields: Record<string, unknown> = {}) => ({
  product: "Carpet Tile",
  code: "CSC-01",
  description: "",
  batch: "",
  covers: "",
  unit: "Box",
  qty: 120,
  ...fields,
});

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("saveDoLines", () => {
  it("replaces the lines in one call and sends the summary", async () => {
    const calls = fakeSupabase([found, ok]);

    const result = await saveDoLines(MOF, JOB, [
      row(),
      row({ code: "", qty: 0 }),
      row({
        product: "Adhesive",
        code: "",
        description: "Glue",
        unit: "Pail",
        qty: 4,
      }),
    ]);

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.name)).toEqual([
      "delivery_orders",
      "rpc:replace_delivery_order_lines",
    ]);
    expect(calls[1]?.payload).toEqual({
      p_job_id: JOB,
      p_lines: [
        {
          product: "Carpet Tile",
          code: "CSC-01",
          description: null,
          batch: null,
          covers: null,
          unit: "Box",
          qty: 120,
        },
        {
          product: "Adhesive",
          code: null,
          description: "Glue",
          batch: null,
          covers: null,
          unit: "Pail",
          qty: 4,
        },
      ],
      p_items: "CSC-01 120 Box, Glue 4 Pail",
    });
  });

  it("leaves the summary alone when every line is dropped", async () => {
    const calls = fakeSupabase([found, ok]);

    await saveDoLines(MOF, JOB, [row({ code: "", qty: 0 })]);

    expect(calls[1]?.payload).toMatchObject({ p_lines: [], p_items: null });
  });

  it("refuses a quantity that is not a number, before touching the database", async () => {
    const calls = fakeSupabase([]);

    const result = await saveDoLines(MOF, JOB, [row({ qty: Number.NaN })]);

    expect(result.error).toMatch(/quantity as a number/);
    expect(calls).toHaveLength(0);
  });

  it("does not find a delivery on another MOF", async () => {
    const calls = fakeSupabase([{ data: [], error: null }]);

    const result = await saveDoLines(MOF, JOB, [row()]);

    expect(result.error).toMatch(/Reload the page/);
    expect(calls).toHaveLength(1);
  });

  it("refuses someone who cannot change a DO", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveDoLines(MOF, JOB, [row()]);

    expect(result.error).toMatch(/Only the MD, Sales Director or Purchasing/);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal from the database", async () => {
    fakeSupabase([found, { data: null, error: { code: "42501" } }]);

    const result = await saveDoLines(MOF, JOB, [row()]);

    expect(result.error).toMatch(/Only the MD, Sales Director or Purchasing/);
  });
});

describe("cancelDo", () => {
  it("postpones the delivery first, then takes the number off", async () => {
    const calls = fakeSupabase([found, found]);

    const result = await cancelDo(MOF, JOB);

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.name)).toEqual(["jobs", "delivery_orders"]);
    expect(calls[0]?.payload).toEqual({ status: "postponed" });
    expect(calls[1]?.payload).toEqual({ running_no: null });
  });

  it("says so when the number could not be taken off", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase([found, { data: null, error: { code: "XX000" } }]);

    const result = await cancelDo(MOF, JOB);

    expect(result.error).toMatch(/postponed, but its DO no. was not cancelled/);
    log.mockRestore();
  });

  it("refuses someone who cannot change a DO", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase([]);

    const result = await cancelDo(MOF, JOB);

    expect(result.error).toMatch(/Only the MD, Sales Director or Purchasing/);
    expect(calls).toHaveLength(0);
  });
});

describe("setNextDoNumber", () => {
  const form = (nextNo: string) => {
    const data = new FormData();
    data.set("nextNo", nextNo);
    return data;
  };

  it("sets the number for Purchasing and HR & Accounts", async () => {
    for (const jobRole of ["support", "accounts", "md"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const calls = fakeSupabase([ok]);

      const result = await setNextDoNumber(form("5563"));

      expect(result).toEqual({ error: null });
      expect(calls[0]).toMatchObject({
        name: "rpc:set_next_do_number",
        payload: { p_next_no: 5563 },
      });
    }
  });

  it("asks for 4 digits", async () => {
    const calls = fakeSupabase([]);

    const result = await setNextDoNumber(form("55"));

    expect(result.error).toBe("Key in 4 digits, e.g. 5563.");
    expect(calls).toHaveLength(0);
  });

  it("shows the database's reason when the number is not above the last used", async () => {
    fakeSupabase([
      {
        data: null,
        error: {
          code: "23514",
          message:
            "The next DO no. must be higher than the last number used (5560).",
        },
      },
    ]);

    const result = await setNextDoNumber(form("5550"));

    expect(result.error).toMatch(/higher than the last number used \(5560\)/);
  });

  it("refuses the Sales Director", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = fakeSupabase([]);

    const result = await setNextDoNumber(form("5563"));

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });
});
