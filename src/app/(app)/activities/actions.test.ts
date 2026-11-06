import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveActivity, setActivityStatus } from "./actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";
const CONTACT = "44444444-4444-4444-8444-444444444444";
const ACTIVITY = "55555555-5555-4555-8555-555555555555";
const SENIOR = "66666666-6666-4666-8666-666666666666";
const JUNIOR = "77777777-7777-4777-8777-777777777777";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = { data: unknown; error: { code?: string } | null };
type Call = { steps: string[]; payload: unknown };

/** Each query on `activities` answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn(() => {
      const call: Call = { steps: [], payload: undefined };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "delete",
        "eq",
        "maybeSingle",
        "single",
      ]) {
        query[step] = (payload?: unknown) => {
          call.steps.push(step);
          if (step === "insert" || step === "update") call.payload = payload;
          if (step === "maybeSingle" || step === "single") {
            return Promise.resolve(result);
          }
          // insert resolves directly; update/select chains resolve at the end.
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

function form(
  fields: Record<string, string>,
  more: { invitesShown?: string; attendeeIds?: string[] } = {},
) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    contactId: CONTACT,
    type: "visit",
    purpose: "Follow up quotation",
    outcome: "",
    startsAt: "2026-10-01T10:00",
    status: "completed",
    ...fields,
  })) {
    data.set(key, value);
  }
  if (more.invitesShown) data.set("invitesShown", more.invitesShown);
  for (const id of more.attendeeIds ?? []) data.append("attendeeIds", id);
  return data;
}

const existing = (
  ownerId: string,
  status: string,
  startsAt = "2026-11-20T02:00:00Z",
): Result => ({
  data: { owner_id: ownerId, status, starts_at: startsAt },
  error: null,
});
const updated: Result = { data: [{ id: ACTIVITY }], error: null };

describe("saveActivity", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("logs an activity under the signed-in person, in Malaysia time", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([{ data: { id: ACTIVITY }, error: null }]);

    const result = await saveActivity(form({}));

    expect(result.error).toBeNull();
    expect(calls[0]?.payload).toMatchObject({
      contact_id: CONTACT,
      owner_id: ME,
      type: "visit",
      outcome: null,
      starts_at: "2026-10-01T02:00:00.000Z",
      status: "completed",
    });
  });

  it("no longer logs a new call", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveActivity(form({ type: "call" }));

    expect(result.error).toMatch(/Calls are no longer logged/);
    expect(calls).toHaveLength(0);
  });

  it("still lets an earlier call be edited", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ME, "planned"), updated]);

    const result = await saveActivity(
      form({ type: "call", activityId: ACTIVITY, status: "planned" }),
    );

    expect(result.error).toBeNull();
    expect(calls.at(-1)?.payload).toMatchObject({ type: "call" });
  });

  it("invites the colleagues ticked in the form", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([
      { data: { id: ACTIVITY }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    const result = await saveActivity(
      form({}, { invitesShown: "yes", attendeeIds: [SENIOR, SENIOR, JUNIOR] }),
    );

    expect(result.error).toBeNull();
    expect(calls.map((call) => call.steps[0])).toEqual([
      "insert",
      "delete",
      "insert",
    ]);
    expect(calls[2]?.payload).toEqual([
      { activity_id: ACTIVITY, profile_id: SENIOR },
      { activity_id: ACTIVITY, profile_id: JUNIOR },
    ]);
  });

  it("leaves the invitations alone when the form did not show the list", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([{ data: { id: ACTIVITY }, error: null }]);

    await saveActivity(form({}, { attendeeIds: [SENIOR] }));

    expect(calls).toHaveLength(1);
  });

  it("uninvites everyone when the list was shown and nobody is ticked", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([
      existing(ME, "planned"),
      updated,
      { data: null, error: null },
    ]);

    const result = await saveActivity(
      form(
        { activityId: ACTIVITY, status: "planned" },
        { invitesShown: "yes" },
      ),
    );

    expect(result.error).toBeNull();
    expect(calls.map((call) => call.steps[0])).toEqual([
      "select",
      "update",
      "delete",
    ]);
  });

  it("says the activity was saved but the invitations were not", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase([
      { data: { id: ACTIVITY }, error: null },
      { data: null, error: null },
      { data: null, error: { code: "42501" } },
    ]);

    const result = await saveActivity(
      form({}, { invitesShown: "yes", attendeeIds: [SENIOR] }),
    );

    expect(result.error).toMatch(
      /saved, but the invitations could not be saved/,
    );
  });

  it("refuses an invitation that is not a real person", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveActivity(
      form({}, { invitesShown: "yes", attendeeIds: ["nobody"] }),
    );

    expect(result.error).toBe("Choose who to invite from the list.");
    expect(calls).toHaveLength(0);
  });

  it("refuses a completed activity dated in the future", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await saveActivity(form({ startsAt: "2999-01-01T10:00" }));

    expect(result.error).toMatch(/future/);
    expect(calls).toHaveLength(0);
  });

  it("lets HR & Accounts read but not log", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase([]);

    const result = await saveActivity(form({}));

    expect(result.error).toMatch(/not log/);
    expect(calls).toHaveLength(0);
  });

  it("lets the owner edit and complete a planned activity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ME, "planned"), updated]);

    const result = await saveActivity(
      form({ activityId: ACTIVITY, outcome: "Asked for revised quote" }),
    );

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toMatchObject({
      outcome: "Asked for revised quote",
      status: "completed",
    });
  });

  it("stops a non-owner from editing", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ARUN, "planned")]);

    const result = await saveActivity(form({ activityId: ACTIVITY }));

    expect(result.error).toMatch(/owns this activity/);
    expect(calls).toHaveLength(1);
  });

  it("lets the Sales Director edit someone else's activity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    fakeSupabase([existing(ARUN, "planned"), updated]);

    const result = await saveActivity(form({ activityId: ACTIVITY }));

    expect(result.error).toBeNull();
  });

  it("does not reopen a completed activity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([existing(ME, "completed")]);

    const result = await saveActivity(
      form({ activityId: ACTIVITY, status: "planned" }),
    );

    expect(result.error).toMatch(/reopened/);
  });

  it("reports a silent no-op from the database as not allowed", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([existing(ME, "planned"), { data: [], error: null }]);

    const result = await saveActivity(form({ activityId: ACTIVITY }));

    expect(result.error).toMatch(/owns this activity/);
  });
});

describe("setActivityStatus", () => {
  const PAST = "2026-10-01T02:00:00Z";

  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("completes a planned activity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ME, "planned", PAST), updated]);

    const result = await setActivityStatus(ACTIVITY, "completed");

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toEqual({ status: "completed" });
  });

  it("cancels a planned activity even when it is still ahead", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ME, "planned"), updated]);

    const result = await setActivityStatus(ACTIVITY, "cancelled");

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toEqual({ status: "cancelled" });
  });

  it("will not complete an activity that has not started", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([
      existing(ME, "planned", "2999-01-01T02:00:00Z"),
    ]);

    const result = await setActivityStatus(ACTIVITY, "completed");

    expect(result.error).toMatch(/hasn't started/);
    expect(calls).toHaveLength(1);
  });

  it("keeps completed and cancelled final", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([existing(ME, "completed", PAST)]);
    expect((await setActivityStatus(ACTIVITY, "cancelled")).error).toMatch(
      /reopened/,
    );

    fakeSupabase([existing(ME, "cancelled", PAST)]);
    expect((await setActivityStatus(ACTIVITY, "completed")).error).toMatch(
      /reopened/,
    );
  });

  it("stops a non-owner", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const calls = fakeSupabase([existing(ARUN, "planned", PAST)]);

    const result = await setActivityStatus(ACTIVITY, "completed");

    expect(result.error).toMatch(/owns this activity/);
    expect(calls).toHaveLength(1);
  });

  it("shows a plain message when the activity cannot be loaded", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    fakeSupabase([{ data: null, error: { code: "XX000" } }]);

    const result = await setActivityStatus(ACTIVITY, "completed");

    expect(result.error).toBe("Could not save the activity. Try again.");
  });

  it("rejects an id that is not a uuid", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([]);

    const result = await setActivityStatus("nope", "completed");

    expect(result.error).toMatch(/Reload/);
    expect(calls).toHaveLength(0);
  });
});
