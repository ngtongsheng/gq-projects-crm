import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { loadQuote } from "./quote-data";
import type { QuoteView } from "./quote-view";
import { setValueFromCosting } from "./use-as-project-value-action";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/access-overrides", () => ({
  loadAccessOverrides: async () => ({}),
}));
vi.mock("./quote-data", () => ({ loadQuote: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const PROJECT = "33333333-3333-4333-8333-333333333333";
const QUOTE = "44444444-4444-4444-8444-444444444444";

const profile: Profile = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ah Kow",
  role: "staff",
  jobRole: "sales",
  arrangesStock: false,
  sells: true,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
};

type Result = { data: unknown; error: { message: string } | null };
type Call = { table: string; payload: unknown };

/** Each query answers with the next queued result; writes are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, payload: undefined };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["select", "update", "eq"]) {
        query[step] = (...args: unknown[]) => {
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

const ok = (data: unknown = []): Result => ({ data, error: null });

function quote(
  status: string,
  overrides: Partial<{ projectId: string | null; chosen: string | null }> = {},
): QuoteView {
  return {
    costShown: false,
    id: QUOTE,
    projectId:
      overrides.projectId === undefined ? PROJECT : overrides.projectId,
    revisions: [
      {
        status,
        chosenOptionId: overrides.chosen ?? null,
        options: [
          { id: "a", sell: 1000 },
          { id: "b", sell: 2500.5 },
        ],
      },
    ],
  } as unknown as QuoteView;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile);
});

describe("setValueFromCosting", () => {
  it("writes the highest option's sell when none is chosen", async () => {
    vi.mocked(loadQuote).mockResolvedValue(quote("approved"));
    const calls = fakeSupabase([ok([]), ok([{ id: PROJECT }])]);

    const result = await setValueFromCosting({
      projectId: PROJECT,
      quoteId: QUOTE,
    });

    expect(result).toEqual({ error: null });
    expect(calls.map((call) => call.table)).toEqual(["mofs", "projects"]);
    expect(calls[1].payload).toEqual({ value: 2500.5 });
  });

  it("writes the option the customer chose", async () => {
    vi.mocked(loadQuote).mockResolvedValue(quote("approved", { chosen: "a" }));
    const calls = fakeSupabase([ok([]), ok([{ id: PROJECT }])]);

    await setValueFromCosting({ projectId: PROJECT, quoteId: QUOTE });

    expect(calls[1].payload).toEqual({ value: 1000 });
  });

  it.each([
    "draft",
    "submitted",
    "returned",
  ])("refuses a costing that is %s", async (status) => {
    vi.mocked(loadQuote).mockResolvedValue(quote(status));
    const calls = fakeSupabase([]);

    const result = await setValueFromCosting({
      projectId: PROJECT,
      quoteId: QUOTE,
    });

    expect(result.error).toMatch(/OK to quote/);
    expect(calls).toEqual([]);
  });

  it("refuses a project that already has an MOF", async () => {
    vi.mocked(loadQuote).mockResolvedValue(quote("approved"));
    const calls = fakeSupabase([ok([{ id: "mof-1" }])]);

    const result = await setValueFromCosting({
      projectId: PROJECT,
      quoteId: QUOTE,
    });

    expect(result.error).toMatch(/MOF/);
    expect(calls.map((call) => call.table)).toEqual(["mofs"]);
  });

  it("refuses a costing that belongs to another project", async () => {
    vi.mocked(loadQuote).mockResolvedValue(
      quote("approved", { projectId: null }),
    );
    const calls = fakeSupabase([]);

    const result = await setValueFromCosting({
      projectId: PROJECT,
      quoteId: QUOTE,
    });

    expect(result.error).not.toBeNull();
    expect(calls).toEqual([]);
  });

  it("says so when the database does not let this person change the project", async () => {
    vi.mocked(loadQuote).mockResolvedValue(quote("approved"));
    fakeSupabase([ok([]), ok([])]);

    const result = await setValueFromCosting({
      projectId: PROJECT,
      quoteId: QUOTE,
    });

    expect(result.error).toMatch(/person in charge/);
  });
});
