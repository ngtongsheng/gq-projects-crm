import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { deleteEnquiry, saveEnquiry } from "./enquiry-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// Page access is the matrix's job; these tests are about what each role may do on the page.
vi.mock("@/lib/auth/page-access", () => ({ canOpen: async () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ENQUIRY = "33333333-3333-4333-8333-333333333333";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Ah Kow",
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
type Call = {
  table: string;
  op: string;
  payload: unknown;
  filters: [string, unknown][];
};

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = {
        table,
        op: "select",
        payload: undefined,
        filters: [],
      };
      calls.push(call);
      const result = results.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "delete",
        "eq",
        "maybeSingle",
      ]) {
        query[step] = (...args: unknown[]) => {
          if (["insert", "update", "delete"].includes(step)) {
            call.op = step;
            call.payload = args[0];
          }
          if (step === "eq") call.filters.push([String(args[0]), args[1]]);
          if (step === "maybeSingle") return Promise.resolve(result);
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
    enquiryId: "",
    enquiryDate: "2026-11-15",
    quoteNo: "gq 5127",
    salespersonId: "none",
    product: "Axminster 42oz",
    sizes: "",
    qty: "1,500",
    unit: "m2",
    supplier: "Sunrise",
    currency: "USD",
    fob: "3.85",
    fx: "",
    shipping: "0.4",
    notes: "6 weeks",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const ok = (data: unknown = [{ id: ENQUIRY }]): Result => ({
  data,
  error: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveEnquiry", () => {
  it("lets a salesperson raise an enquiry for themselves without any reply", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([ok()]);

    const result = await saveEnquiry(
      form({ salespersonId: OTHER, fob: "9.99", notes: "cheap" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[0]).toMatchObject({ table: "fob_enquiries", op: "insert" });
    expect(calls[0].payload).toEqual({
      enquiry_date: "2026-11-15",
      quote_no: "GQ5127",
      product: "Axminster 42oz",
      sizes: null,
      qty: 1500,
      unit: "m2",
      supplier: "Sunrise",
      salesperson_id: ME,
    });
  });

  it("does not let a salesperson change the reply when editing their enquiry", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([ok()]);

    await saveEnquiry(form({ enquiryId: ENQUIRY, fob: "1", shipping: "0" }));

    expect(calls[0].op).toBe("update");
    expect(calls[0].payload).not.toHaveProperty("fob");
    expect(calls[0].payload).not.toHaveProperty("fx");
    expect(calls[0].payload).not.toHaveProperty("shipping");
    expect(calls[0].payload).not.toHaveProperty("currency");
    expect(calls[0].payload).not.toHaveProperty("notes");
    expect(calls[0].payload).not.toHaveProperty("salesperson_id");
    expect(calls[0].filters).toEqual([["id", ENQUIRY]]);
  });

  it("saves purchasing's reply with the usual rate when none is keyed in", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([ok()]);

    const result = await saveEnquiry(
      form({ enquiryId: ENQUIRY, salespersonId: OTHER, currency: "RMB" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[0].payload).toMatchObject({
      currency: "RMB",
      fob: 3.85,
      fx: 0.6024,
      shipping: 0.4,
      notes: "6 weeks",
      salesperson_id: OTHER,
    });
    // Who replied and when come from the database, never from the form.
    expect(calls[0].payload).not.toHaveProperty("replied_by");
    expect(calls[0].payload).not.toHaveProperty("replied_at");
  });

  it("takes the costing's salesperson when purchasing leaves it blank", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([ok({ salesperson_id: OTHER }), ok()]);

    await saveEnquiry(form());

    expect(calls[0]).toMatchObject({ table: "quotes", op: "select" });
    expect(calls[0].filters).toEqual([["quote_no", "GQ5127"]]);
    expect(calls[1].payload).toMatchObject({ salesperson_id: OTHER });
  });

  it("works the area out of a size list", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([ok({ salesperson_id: OTHER }), ok()]);

    await saveEnquiry(
      form({ sizes: "2 x 1.5 x 10\n1x1x5", qty: "1", unit: "pc" }),
    );

    expect(calls[1].payload).toMatchObject({ qty: 35, unit: "m2" });
  });

  it("keeps a reply blank while the supplier has not given a price", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = fakeSupabase([ok({ salesperson_id: OTHER }), ok()]);

    await saveEnquiry(form({ fob: "", shipping: "", notes: "" }));

    expect(calls[1].payload).toMatchObject({
      fob: null,
      fx: null,
      shipping: null,
      notes: null,
    });
  });

  it.each([
    "site",
    "marketing",
    "designer",
    "ssup",
  ] as const)("refuses a %s", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = fakeSupabase([]);

    const result = await saveEnquiry(form());

    expect(result.error).toMatch(/Only salespeople/);
    expect(calls).toHaveLength(0);
  });

  it.each([
    [{ product: " " }, "Enter the product or spec."],
    [{ fob: "abc" }, "Enter the FOB as a number."],
    [{ qty: "-1" }, "The quantity cannot be negative."],
    [{ enquiryDate: "" }, "Choose the date."],
  ])("refuses %j before touching the database", async (fields, message) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([]);

    expect(await saveEnquiry(form(fields))).toEqual({ error: message });
    expect(calls).toHaveLength(0);
  });

  it("says so when the enquiry is not the person's to change", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([{ data: [], error: null }]);

    expect(await saveEnquiry(form({ enquiryId: ENQUIRY }))).toEqual({
      error: "Could not find that enquiry. Reload the page.",
    });
  });
});

describe("deleteEnquiry", () => {
  it("lets a salesperson remove only an enquiry that is still waiting", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([ok()]);

    expect(await deleteEnquiry(ENQUIRY)).toEqual({ error: null });
    expect(calls[0].filters).toEqual([
      ["id", ENQUIRY],
      ["status", "pending"],
    ]);
  });

  it("explains why a replied enquiry stays", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    fakeSupabase([{ data: [], error: null }]);

    expect((await deleteEnquiry(ENQUIRY)).error).toMatch(/already replied/);
  });

  it("lets the enquiry desk remove any enquiry", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([ok()]);

    expect(await deleteEnquiry(ENQUIRY)).toEqual({ error: null });
    expect(calls[0].filters).toEqual([["id", ENQUIRY]]);
  });
});
