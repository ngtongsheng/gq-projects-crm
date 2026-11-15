import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  addFollowUp,
  saveSiteVisit,
  setFollowUpDone,
  setSiteStage,
} from "./actions";

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
const MOF = "33333333-3333-4333-8333-333333333333";
const LOG = "44444444-4444-4444-8444-444444444444";
const FOLLOW_UP = "55555555-5555-4555-8555-555555555555";
const SALES = "66666666-6666-4666-8666-666666666666";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Awal",
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
type Call = { name: string; payload: unknown };

/** Each query takes the next result in line; calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const next = () => queue.shift() ?? { data: [], error: null };
  const client = {
    rpc: vi.fn((name: string, args: unknown) => {
      calls.push({ name, payload: args });
      return Promise.resolve(next());
    }),
    from: vi.fn((table: string) => {
      const call: Call = { name: table, payload: undefined };
      calls.push(call);
      const result = next();
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "select", "maybeSingle"]) {
        query[step] = (...args: unknown[]) => {
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

const followUpForm = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    siteLogId: LOG,
    action: " Order 2 more rolls ",
    ownerGroup: "purchasing",
    dueOn: "2026-11-09",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("setSiteStage", () => {
  it("lets a site supervisor move the stage", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await setSiteStage(MOF, "installation");

    expect(result).toEqual({ error: null });
    expect(calls[0]).toEqual({
      name: "set_site_stage",
      payload: { mof_id: MOF, stage: "installation" },
    });
  });

  it("refuses roles outside the site team before touching the database", async () => {
    for (const role of ["sales", "support", "accounts"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await setSiteStage(MOF, "completed");

      expect(result.error).toMatch(/Only the MD/);
      expect(calls).toHaveLength(0);
    }
  });

  it("rejects an unknown stage", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    const result = await setSiteStage(MOF, "nearly-done");

    expect(result.error).toMatch(/Choose the site stage/);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal from the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ data: null, error: { code: "42501" } });

    const result = await setSiteStage(MOF, "completed");

    expect(result.error).toMatch(/Only the MD/);
  });
});

describe("addFollowUp", () => {
  it("saves a follow-up with an owner and due date", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await addFollowUp(followUpForm());

    expect(result).toEqual({ error: null });
    expect(calls[0]).toEqual({
      name: "site_follow_ups",
      payload: {
        site_log_id: LOG,
        action: "Order 2 more rolls",
        owner_group: "purchasing",
        assignee_id: null,
        due_on: "2026-11-09",
      },
    });
  });

  it("saves who the follow-up is assigned to", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    await addFollowUp(followUpForm({ assigneeId: SALES }));

    expect(calls[0]?.payload).toMatchObject({ assignee_id: SALES });
  });

  it("allows no due date", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    await addFollowUp(followUpForm({ dueOn: "" }));

    expect(calls[0]?.payload).toMatchObject({ due_on: null });
  });

  it("needs an action and a known owner", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));

    expect((await addFollowUp(followUpForm({ action: "  " }))).error).toMatch(
      /what needs to be done/,
    );
    expect(
      (await addFollowUp(followUpForm({ ownerGroup: "landlord" }))).error,
    ).toMatch(/who owns it/);
  });

  it("refuses roles outside the site team", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    const result = await addFollowUp(followUpForm());

    expect(result.error).toMatch(/Only the MD/);
    expect(calls).toHaveLength(0);
  });
});

describe("setFollowUpDone", () => {
  it("lets the owning group close a follow-up", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({ data: [{ id: FOLLOW_UP }], error: null });

    const result = await setFollowUpDone(MOF, FOLLOW_UP, "purchasing", true);

    expect(result).toEqual({ error: null });
    expect(calls[0]?.name).toBe("site_follow_ups");
    expect(calls[0]?.payload).toEqual({ done_at: expect.any(String) });
  });

  it("reopens a follow-up by clearing the done time", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({ data: [{ id: FOLLOW_UP }], error: null });

    await setFollowUpDone(MOF, FOLLOW_UP, "client", false);

    expect(calls[0]?.payload).toEqual({ done_at: null });
  });

  it("refuses someone outside the owning group", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    const result = await setFollowUpDone(MOF, FOLLOW_UP, "purchasing", true);

    expect(result.error).toMatch(/group that owns/);
    expect(calls).toHaveLength(0);
  });

  it("lets the person it is assigned to close it", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ data: [{ id: FOLLOW_UP }], error: null });

    const result = await setFollowUpDone(
      MOF,
      FOLLOW_UP,
      "purchasing",
      true,
      ME,
    );

    expect(result).toEqual({ error: null });
  });

  it("closes a follow-up from a visit with no MOF", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ data: [{ id: FOLLOW_UP }], error: null });

    const result = await setFollowUpDone(null, FOLLOW_UP, "client", true);

    expect(result).toEqual({ error: null });
  });

  it("reports a follow-up the database hides", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase({ data: [], error: null });

    const result = await setFollowUpDone(MOF, FOLLOW_UP, "purchasing", true);

    expect(result.error).toMatch(/Could not find that follow-up/);
  });
});

describe("saveSiteVisit", () => {
  const ok = { data: null, error: null };
  const mofAt = (site_stage: string) => ({
    data: { site_stage, salesperson_id: SALES },
    error: null,
  });
  const savedLogs = { data: [{ id: LOG }], error: null };
  const visit = (fields: Record<string, unknown> = {}) => ({
    mofId: MOF,
    visitedOn: "2026-11-16",
    activities: ["inspection"],
    note: " Level 3 ",
    ...fields,
  });

  it("saves one log per activity with each one's answers", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(mofAt("ongoing"), savedLogs, ok, ok);

    const result = await saveSiteVisit(
      visit({
        activities: ["measurement", "shooting", "delivery"],
        measurementSent: true,
        photosPosted: false,
        deliveryOk: true,
        returnAnswer: "No balance stock",
      }),
    );

    expect(result).toEqual({ error: null, movedTo: "delivered" });
    const rows = calls[1]?.payload as Record<string, unknown>[];
    expect(rows.map((row) => row.activity)).toEqual([
      "measurement",
      "shooting",
      "delivery",
    ]);
    expect(rows[0]).toMatchObject({
      mof_id: MOF,
      site_name: null,
      notes: "Level 3",
      measurement_to: SALES,
      measurement_sent_on: "2026-11-16",
      return_answer: "No balance stock",
    });
    expect(rows[1]).toMatchObject({
      photos_posted_on: null,
      return_answer: null,
    });
    expect(rows[1]).toMatchObject({ measurement_to: null });
    expect(rows[2]).toMatchObject({ delivery_ok: true });
    expect(calls[2]).toEqual({
      name: "shoot_requests",
      payload: { status: "done" },
    });
    expect(calls[3]).toEqual({
      name: "set_site_stage",
      payload: { mof_id: MOF, stage: "delivered" },
    });
  });

  it("leaves shooting requests alone when no shooting was logged", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(mofAt("ongoing"), savedLogs);

    await saveSiteVisit(visit({ activities: ["inspection"] }));

    expect(calls.map((call) => call.name)).not.toContain("shoot_requests");
  });

  it("moves the stage to installation and completes it on a signed handover", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase(mofAt("delivered"), savedLogs, ok);
    expect(
      await saveSiteVisit(
        visit({ activities: ["installation"], installedPct: 40 }),
      ),
    ).toEqual({ error: null, movedTo: "installation" });

    const calls = fakeSupabase(mofAt("installation"), savedLogs, ok);
    const result = await saveSiteVisit(
      visit({
        activities: ["installation", "handover"],
        installedPct: 100,
        handoverSigned: true,
        completedPhotosPosted: true,
      }),
    );
    expect(result).toEqual({ error: null, movedTo: "completed" });
    const rows = calls[1]?.payload as Record<string, unknown>[];
    expect(rows[0]).toMatchObject({ inst_pct: 100, handover_signed: false });
    expect(rows[1]).toMatchObject({
      inst_pct: null,
      handover_signed: true,
      photos_posted_on: "2026-11-16",
    });
  });

  it("never moves a stage backwards", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(mofAt("completed"), savedLogs);

    const result = await saveSiteVisit(
      visit({ activities: ["installation"], installedPct: 30 }),
    );

    expect(result).toEqual({ error: null, movedTo: null });
    expect(calls.map((call) => call.name)).toEqual(["mofs", "site_logs"]);
  });

  it("saves a visit to a new site with no MOF and no stage move", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(savedLogs);

    const result = await saveSiteVisit(
      visit({
        mofId: null,
        siteName: "Menara KL",
        salespersonId: SALES,
        activities: ["measurement"],
        measurementSent: false,
      }),
    );

    expect(result).toEqual({ error: null, movedTo: null });
    expect(calls).toHaveLength(1);
    expect((calls[0]?.payload as Record<string, unknown>[])[0]).toMatchObject({
      mof_id: null,
      site_name: "Menara KL",
      salesperson_id: SALES,
      project_id: null,
      measurement_to: SALES,
      measurement_sent_on: null,
    });
  });

  it("adds the follow-up to the first log", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(mofAt("start"), savedLogs, ok);

    await saveSiteVisit(
      visit({
        followUp: {
          action: " Order 2 more rolls ",
          ownerGroup: "purchasing",
          dueOn: "2026-11-18",
        },
      }),
    );

    expect(calls[2]).toEqual({
      name: "site_follow_ups",
      payload: {
        site_log_id: LOG,
        action: "Order 2 more rolls",
        owner_group: "purchasing",
        due_on: "2026-11-18",
      },
    });
  });

  it("needs every question answered before touching the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ activities: [] }, /what you did/],
      [{ activities: ["installation"] }, /how much of the whole job/],
      [{ activities: ["handover"], handoverSigned: true }, /completed photos/],
      [{ activities: ["delivery"] }, /delivery arrived/],
      [{ mofId: null }, /site name/],
      [{ mofId: null, siteName: "Menara KL" }, /salesperson/],
      [{ activities: ["inspection", "inspection"] }, /each activity once/],
    ];
    for (const [fields, message] of cases) {
      const calls = fakeSupabase();
      const result = await saveSiteVisit(visit(fields));
      expect(result.error).toMatch(message);
      expect(calls).toHaveLength(0);
    }
  });

  it("refuses roles outside the site team", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    const result = await saveSiteVisit(visit());

    expect(result.error).toMatch(/Only the MD/);
    expect(calls).toHaveLength(0);
  });

  it("says the visit is saved when the stage could not move", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase(mofAt("shipment"), savedLogs, {
      data: null,
      error: { code: "XX000" },
    });

    const result = await saveSiteVisit(
      visit({ activities: ["delivery"], deliveryOk: false }),
    );

    expect(result).toEqual({
      error:
        "The visit is saved, but the site stage did not move to Delivered. Set it on the MOF.",
      movedTo: null,
    });
  });
});
