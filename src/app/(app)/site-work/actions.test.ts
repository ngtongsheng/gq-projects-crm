import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  addFollowUp,
  addSiteLog,
  setFollowUpDone,
  setSiteStage,
} from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
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

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Awal",
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
      for (const step of ["insert", "update", "eq", "select"]) {
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

const logForm = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    visitedOn: "2026-11-02",
    activity: "inspection",
    notes: " Skirting not fixed ",
    driveLink: "https://drive.google.com/drive/folders/abc",
    handoverSigned: "on",
    ...fields,
  });

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

describe("addSiteLog", () => {
  it("saves a visit with the Drive link and flags", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await addSiteLog(logForm());

    expect(result).toEqual({ error: null });
    expect(calls[0]).toEqual({
      name: "site_logs",
      payload: {
        mof_id: MOF,
        visited_on: "2026-11-02",
        activity: "inspection",
        notes: "Skirting not fixed",
        measurement_received: false,
        drive_link: "https://drive.google.com/drive/folders/abc",
        handover_signed: true,
      },
    });
  });

  it("keeps the Drive link empty when none is given", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    await addSiteLog(logForm({ driveLink: "  ", notes: "" }));

    expect(calls[0]?.payload).toMatchObject({ drive_link: null, notes: null });
  });

  it("rejects a Drive link that is not a web address", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    for (const driveLink of [
      "drive folder",
      "ftp://files.example.com/a",
      "javascript:alert(1)",
      "https://",
    ]) {
      const calls = fakeSupabase();

      const result = await addSiteLog(logForm({ driveLink }));

      expect(result.error).toMatch(/web address/);
      expect(calls).toHaveLength(0);
    }
  });

  it("rejects an unknown activity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    const result = await addSiteLog(logForm({ activity: "napping" }));

    expect(result.error).toMatch(/Choose the activity/);
    expect(calls).toHaveLength(0);
  });

  it("refuses roles outside the site team", async () => {
    for (const role of ["sales", "support", "bd"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await addSiteLog(logForm());

      expect(result.error).toMatch(/Only the MD/);
      expect(calls).toHaveLength(0);
    }
  });

  it("lets the MD and Sales Director log a visit", async () => {
    for (const role of ["md", "director"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      fakeSupabase({ data: null, error: null });

      expect(await addSiteLog(logForm())).toEqual({ error: null });
    }
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
        due_on: "2026-11-09",
      },
    });
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

  it("reports a follow-up the database hides", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase({ data: [], error: null });

    const result = await setFollowUpDone(MOF, FOLLOW_UP, "purchasing", true);

    expect(result.error).toMatch(/Could not find that follow-up/);
  });
});
