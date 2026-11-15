import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  reviewWeeklyReport,
  submitWeeklyReport,
} from "./weekly-report-actions";

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
const REPORT = "55555555-5555-4555-8555-555555555555";
const MONDAY = "2026-11-09";

const salesperson: Profile = {
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole: "sales",
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
};

type Result = {
  data?: unknown;
  count?: number | null;
  error: { code?: string; message?: string } | null;
};
type Call = {
  table: string;
  payload: unknown;
  filters: [string, string, unknown][];
};

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, payload: undefined, filters: [] };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "eq",
        "gte",
        "lt",
        "lte",
        "single",
      ]) {
        query[step] = (...args: unknown[]) => {
          if (step === "insert" || step === "update") call.payload = args[0];
          if (["eq", "gte", "lt", "lte"].includes(step)) {
            call.filters.push([step, String(args[0]), args[1]]);
          }
          if (step === "single") return Promise.resolve(result);
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

function signInAs(patch: Partial<Profile>) {
  vi.mocked(getCurrentProfile).mockResolvedValue({ ...salesperson, ...patch });
}

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  signInAs({});
});

describe("submitWeeklyReport", () => {
  it("sends only the week and note, and reads lateness back from the database", async () => {
    const calls = fakeSupabase([
      { count: 0, error: null },
      { data: { late: true }, error: null },
    ]);

    const result = await submitWeeklyReport(MONDAY, "  Two quotations out ");

    expect(result).toEqual({ error: null, late: true });
    expect(calls[1]).toMatchObject({
      table: "weekly_reports",
      payload: { week: MONDAY, note: "Two quotations out" },
    });
  });

  it("checks only the signed-in person's outcomes for that Malaysia week", async () => {
    const calls = fakeSupabase([
      { count: 0, error: null },
      { data: { late: false }, error: null },
    ]);

    await submitWeeklyReport(MONDAY, "");

    expect(calls[0].filters).toEqual(
      expect.arrayContaining([
        ["eq", "owner_id", ME],
        ["eq", "status", "planned"],
        ["gte", "starts_at", "2026-11-09T00:00:00+08:00"],
        ["lt", "starts_at", "2026-11-16T00:00:00+08:00"],
      ]),
    );
    expect(calls[1].payload).toEqual({ week: MONDAY, note: null });
  });

  it("refuses while visit outcomes are still to log", async () => {
    const calls = fakeSupabase([{ count: 2, error: null }]);

    const result = await submitWeeklyReport(MONDAY, "");

    expect(result.error).toBe("Log the outcome of 2 visits first.");
    expect(calls).toHaveLength(1);
  });

  it("refuses a day that is not a Monday", async () => {
    const calls = fakeSupabase([]);
    const result = await submitWeeklyReport("2026-11-10", "");
    expect(result.error).toBe("Choose the week to submit.");
    expect(calls).toHaveLength(0);
  });

  it("refuses roles that do not file a weekly report", async () => {
    signInAs({ jobRole: "director" });
    const calls = fakeSupabase([]);
    const result = await submitWeeklyReport(MONDAY, "");
    expect(result.error).toBe("Only salespeople submit a weekly report.");
    expect(calls).toHaveLength(0);
  });

  it("says so when the week is already submitted", async () => {
    fakeSupabase([
      { count: 0, error: null },
      { data: null, error: { code: "23505" } },
    ]);
    const result = await submitWeeklyReport(MONDAY, "");
    expect(result.error).toBe(
      "You already submitted the report for this week.",
    );
  });
});

describe("reviewWeeklyReport", () => {
  it("marks a submitted report reviewed with the comment", async () => {
    signInAs({ jobRole: "md" });
    const calls = fakeSupabase([{ data: [{ id: REPORT }], error: null }]);

    const result = await reviewWeeklyReport(REPORT, " Good week ");

    expect(result).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      table: "weekly_reports",
      payload: { status: "reviewed", review_note: "Good week" },
    });
    expect(calls[0].filters).toEqual([
      ["eq", "id", REPORT],
      ["eq", "status", "submitted"],
    ]);
  });

  it("is refused for a director outside the salesperson's team", async () => {
    signInAs({ jobRole: "director" });
    // Row-level security hides the report from the update, so nothing changes.
    fakeSupabase([{ data: [], error: null }]);

    const result = await reviewWeeklyReport(REPORT, "");

    expect(result.error).toBe(
      "You can't review this report. Only the MD or the salesperson's team lead can, once it is submitted.",
    );
  });
});
