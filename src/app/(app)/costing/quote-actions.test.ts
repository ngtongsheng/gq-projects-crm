import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { createQuote } from "./quote-actions";

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

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const PROJECT = "33333333-3333-4333-8333-333333333333";
const QUOTE = "44444444-4444-4444-8444-444444444444";
const REVISION = "55555555-5555-4555-8555-555555555555";

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
type Call = { table: string; payload: unknown };

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, payload: undefined };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["select", "insert", "eq", "maybeSingle", "single"]) {
        query[step] = (...args: unknown[]) => {
          if (step === "insert") call.payload = args[0];
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

function form(fields: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    quoteNo: "gq 5158",
    projectId: "",
    projectName: "Corporate office",
    customerName: "Acme",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const ok = (data: unknown = null): Result => ({ data, error: null });
const happyPath = () => [ok({ id: QUOTE }), ok({ id: REVISION }), ok(), ok()];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
});

describe("createQuote", () => {
  it("starts the costing under the signed-in salesperson with an Original draft and Option A", async () => {
    const calls = fakeSupabase(happyPath());

    const result = await createQuote(
      form({ salespersonId: OTHER, projectId: "" }),
    );

    expect(result).toEqual({ error: null, quoteId: QUOTE });
    expect(calls.map((call) => call.table)).toEqual([
      "quotes",
      "quote_revisions",
      "quote_options",
      "quote_revision_history",
    ]);
    expect(calls[0].payload).toEqual({
      quote_no: "GQ5158",
      project_id: null,
      project_name: "Corporate office",
      customer_name: "Acme",
      salesperson_id: ME,
    });
    expect(calls[1].payload).toEqual({
      quote_id: QUOTE,
      rev: 0,
      status: "draft",
    });
    expect(calls[2].payload).toEqual({
      revision_id: REVISION,
      key: "A",
      label: "",
    });
    expect(calls[3].payload).toEqual({
      revision_id: REVISION,
      action: "created",
    });
  });

  it("links a project the person can read", async () => {
    const calls = fakeSupabase([ok({ id: PROJECT }), ...happyPath()]);

    const result = await createQuote(form({ projectId: PROJECT }));

    expect(result.error).toBeNull();
    expect(calls[0].table).toBe("projects");
    expect(calls[1].payload).toMatchObject({ project_id: PROJECT });
  });

  it.each([
    ["a blank number", { quoteNo: "  " }, "Key in the quotation number."],
    [
      "a number of only symbols",
      { quoteNo: "#/$" },
      "Key in the quotation number.",
    ],
    ["a reserved word", { quoteNo: "new" }, "This number can't be used."],
    [
      "a revision number",
      { quoteNo: "GQ5127-R1" },
      "Key in the base number, for example GQ5127. A revision is opened from the costing itself.",
    ],
    [
      "a number that is too long",
      { quoteNo: "G".repeat(41) },
      "Keep the quotation number under 40 characters.",
    ],
    [
      "a project that is not an id",
      { projectId: "not-an-id" },
      "Pick a project from the list.",
    ],
    [
      "a long customer name",
      { customerName: "x".repeat(201) },
      "Keep the customer name under 200 characters.",
    ],
  ])("refuses %s without touching the database", async (_label, fields, message) => {
    const calls = fakeSupabase([]);

    expect(await createQuote(form(fields))).toEqual({ error: message });
    expect(calls).toHaveLength(0);
  });

  it("refuses a role that does not sell", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase([]);

    expect(await createQuote(form())).toEqual({
      error: "Only salespeople start a costing.",
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses a project the person cannot read", async () => {
    const calls = fakeSupabase([ok(null)]);

    const result = await createQuote(form({ projectId: PROJECT }));

    expect(result.error).toMatch(/Could not find that project/);
    expect(calls).toHaveLength(1);
  });

  it("opens the costing when the number is already theirs", async () => {
    const calls = fakeSupabase([
      { data: null, error: { code: "23505" } },
      ok({ id: QUOTE }),
    ]);

    expect(await createQuote(form())).toEqual({
      error: null,
      quoteId: QUOTE,
      existing: true,
    });
    expect(calls.map((call) => call.table)).toEqual(["quotes", "quotes"]);
  });

  it("says so when the number belongs to a costing they cannot see", async () => {
    fakeSupabase([{ data: null, error: { code: "23505" } }, ok(null)]);

    expect(await createQuote(form())).toEqual({
      error: "That quotation number belongs to another costing.",
    });
  });

  it("gives a plain message when a later step fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase([
      ok({ id: QUOTE }),
      { data: null, error: { code: "XX000", message: "boom" } },
    ]);

    expect(await createQuote(form())).toEqual({
      error: "Could not start the costing. Try again.",
    });
  });
});
