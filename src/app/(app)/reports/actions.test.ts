import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { type ReportStats, ReportTargets } from "@/lib/domain/report-stats";
import { createClient } from "@/lib/supabase/server";
import { reviewReport, saveReportDraft, submitReport } from "./actions";
import { loadLiveStats, loadReportSettings } from "./report-data";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("./report-data", () => ({
  loadLiveStats: vi.fn(),
  loadReportSettings: vi.fn(),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const REPORT = "77777777-7777-4777-8777-777777777777";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Vernice",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

const STATS: ReportStats = {
  kind: "sales",
  visits: 12,
  visitTarget: 50,
  newCustomers: 3,
  quotations: 2,
  awardedCount: 1,
  awardedValue: 1000,
};

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = {
  table: string;
  payload?: unknown;
  options?: unknown;
  filters: unknown[][];
};

function fakeSupabase(result: Result = { data: null, error: null }) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const query: Record<string, unknown> = {};
      for (const step of ["upsert", "update", "eq", "in", "select", "single"]) {
        query[step] = (...args: unknown[]) => {
          if (step === "upsert" || step === "update") {
            call.payload = args[0];
            call.options = args[1];
          }
          if (step === "eq" || step === "in") call.filters.push(args);
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

function reportForm(fields: Record<string, string> = {}) {
  const data = new FormData();
  const all: Record<string, string> = {
    month: "2026-10-01",
    highlightCompany0: " Law firm, Mont Kiara ",
    highlightAchievement0: " Final negotiation ",
    highlightCompany1: "Bangsar designers",
    highlightAchievement1: "Opened 4 accounts",
    highlightCompany2: "Bank branches",
    highlightAchievement2: "Mock-up approved",
    highlightCompany3: "",
    highlightAchievement3: "",
    nextMonthPlan: " Push the university job ",
    supportNeeded: "",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T03:00:00Z"));
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  vi.mocked(loadReportSettings).mockResolvedValue({
    dueTime: "09:00",
    targets: ReportTargets.parse({}),
  });
  vi.mocked(loadLiveStats).mockResolvedValue(STATS);
});

describe("saveReportDraft", () => {
  it("saves the person's draft without figures, one per month", async () => {
    const calls = fakeSupabase();
    expect(await saveReportDraft(reportForm())).toEqual({
      error: null,
      message: "Draft saved.",
    });
    expect(calls[0]).toMatchObject({
      table: "monthly_reports",
      options: { onConflict: "profile_id,month" },
      payload: {
        month: "2026-10-01",
        status: "draft",
        stats: null,
        highlights: [
          { company: "Law firm, Mont Kiara", achievement: "Final negotiation" },
          { company: "Bangsar designers", achievement: "Opened 4 accounts" },
          { company: "Bank branches", achievement: "Mock-up approved" },
        ],
        next_month_plan: "Push the university job",
        support_needed: null,
        pass_downs_confirmed: false,
      },
    });
    expect(loadLiveStats).not.toHaveBeenCalled();
  });

  it("refuses people who do not file a monthly report", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase();
    expect(await saveReportDraft(reportForm())).toEqual({
      error:
        "Only salespeople, the BD Director and Site Supervisors file monthly reports.",
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses a month that has not started", async () => {
    const calls = fakeSupabase();
    const result = await saveReportDraft(reportForm({ month: "2026-12-01" }));
    expect(result.error).toMatch(/has not started/);
    expect(calls).toHaveLength(0);
  });

  it("tells the person when the report is already submitted", async () => {
    fakeSupabase({ data: null, error: { code: "42501" } });
    expect((await saveReportDraft(reportForm())).error).toMatch(
      /already submitted/,
    );
  });
});

describe("submitReport", () => {
  it("needs at least 3 highlights from a salesperson", async () => {
    const calls = fakeSupabase();
    const result = await submitReport(
      reportForm({ highlightAchievement2: " " }),
    );
    expect(result.error).toMatch(/at least 3 highlights/);
    expect(calls).toHaveLength(0);
  });

  it("freezes the figures and reports an on-time submission", async () => {
    const calls = fakeSupabase({
      data: { submitted_at: "2026-11-02T00:59:00+00:00" },
      error: null,
    });
    expect(await submitReport(reportForm())).toEqual({
      error: null,
      message: "Report submitted on time.",
    });
    expect(loadLiveStats).toHaveBeenCalledWith(
      "sales",
      ME,
      "2026-10-01",
      expect.objectContaining({ salesVisits: 50 }),
    );
    expect(calls[0].payload).toMatchObject({
      status: "submitted",
      stats: STATS,
    });
  });

  it("flags a submission after the first Monday's due time as late", async () => {
    // October 2026 was due Monday 2 November 2026, 9:00 AM Malaysia time.
    fakeSupabase({
      data: { submitted_at: "2026-11-02T01:00:01+00:00" },
      error: null,
    });
    expect((await submitReport(reportForm())).message).toBe(
      "Report submitted late.",
    );
  });

  it("needs the BD Director's pass-down confirmation", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const calls = fakeSupabase({ data: { submitted_at: null }, error: null });
    expect((await submitReport(reportForm())).error).toMatch(/pass-down/);
    expect(calls).toHaveLength(0);

    await submitReport(reportForm({ passDownsConfirmed: "on" }));
    expect(loadLiveStats).toHaveBeenCalledWith(
      "bd",
      ME,
      "2026-10-01",
      expect.anything(),
    );
    expect(calls[0].payload).toMatchObject({ pass_downs_confirmed: true });
  });

  it("lets a Site Supervisor submit without highlights", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ data: { submitted_at: null }, error: null });
    const result = await submitReport(
      reportForm({
        highlightAchievement0: "",
        highlightAchievement1: "",
        highlightAchievement2: "",
      }),
    );
    expect(result.error).toBeNull();
  });
});

describe("reviewReport", () => {
  it("refuses anyone but the MD and Sales Director", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase();
    expect((await reviewReport(REPORT, "")).error).toMatch(
      /Only the MD or Sales Director/,
    );
    expect(calls).toHaveLength(0);
  });

  it("marks a submitted report reviewed with the comment", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({ data: [{ id: REPORT }], error: null });
    expect(await reviewReport(REPORT, " Good month ")).toEqual({
      error: null,
      message: "Marked as reviewed.",
    });
    expect(calls[0]).toMatchObject({
      payload: { status: "reviewed", review_note: "Good month" },
      filters: [
        ["id", REPORT],
        ["status", "submitted"],
        ["kind", ["sales", "bd", "site"]],
      ],
    });
  });

  it("lets only the MD review the BD Director's report", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = fakeSupabase({ data: [{ id: REPORT }], error: null });
    await reviewReport(REPORT, "");
    expect(calls[0].filters).toContainEqual(["kind", ["sales", "site"]]);
  });

  it("explains when the database finds nothing to review", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    fakeSupabase({ data: [], error: null });
    expect((await reviewReport(REPORT, "")).error).toMatch(
      /not waiting for your review/,
    );
  });
});
