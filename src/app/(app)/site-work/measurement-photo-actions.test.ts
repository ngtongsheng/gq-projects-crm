import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  cancelShootRequest,
  receiveMeasurement,
  requestShooting,
  savePhotosToDrive,
} from "./measurement-photo-actions";

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
const REQUEST = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Vernice",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

type Failure = { code?: string } | null;

function fakeSupabase(error: Failure = null, updated: unknown[] = [{}]) {
  const insert = vi.fn(() => Promise.resolve({ data: null, error }));
  const rpc = vi.fn(() => Promise.resolve({ data: null, error }));
  const update = vi.fn(() => {
    const query: Record<string, unknown> = {};
    query.eq = () => query;
    query.select = () => Promise.resolve({ data: updated, error });
    return query;
  });
  vi.mocked(createClient).mockResolvedValue({
    rpc,
    from: vi.fn(() => ({ insert, update })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { insert, rpc, update };
}

const form = (fields: Record<string, string> = {}) => {
  const data = new FormData();
  const all = {
    mofId: MOF,
    kind: "photos_video",
    dueOn: "2026-11-20",
    bestOn: "",
    supervisorId: "",
    note: " Corridor pattern ",
    ...fields,
  };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: new Date("2026-11-16T02:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("requestShooting", () => {
  it("saves the request with blank optional fields as null", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const { insert } = fakeSupabase();

    expect(await requestShooting(form())).toEqual({ error: null });
    expect(insert).toHaveBeenCalledWith({
      mof_id: MOF,
      kind: "photos_video",
      due_on: "2026-11-20",
      best_on: null,
      supervisor_id: null,
      note: "Corridor pattern",
    });
  });

  it("refuses the site team, who answer requests but do not make them", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const { insert } = fakeSupabase();

    const result = await requestShooting(form());

    expect(result.error).toMatch(/Only sales/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses a due date in the past and a missing MOF", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
    const { insert } = fakeSupabase();

    expect((await requestShooting(form({ dueOn: "2026-11-15" }))).error).toBe(
      "The due date cannot be in the past.",
    );
    expect((await requestShooting(form({ mofId: "" }))).error).toBe(
      "Choose the MOF.",
    );
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("savePhotosToDrive", () => {
  it("passes a trimmed Drive link to the database function", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("ssup"));
    const { rpc } = fakeSupabase();

    const result = await savePhotosToDrive({
      siteLogId: LOG,
      link: " https://drive.google.com/drive/folders/abc ",
    });

    expect(result).toEqual({ error: null });
    expect(rpc).toHaveBeenCalledWith("save_photos_to_drive", {
      site_log_id: LOG,
      drive_link: "https://drive.google.com/drive/folders/abc",
    });
  });

  it("refuses a link that is not Google Drive before calling the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("ssup"));
    const { rpc } = fakeSupabase();

    const result = await savePhotosToDrive({
      siteLogId: LOG,
      link: "https://dropbox.com/x",
    });

    expect(result.error).toMatch(/Google Drive folder link/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("says so when the database refuses the person", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    fakeSupabase({ code: "42501" });

    const result = await savePhotosToDrive({
      siteLogId: LOG,
      link: "https://drive.google.com/drive/folders/abc",
    });

    expect(result.error).toMatch(/not posted yet, or you cannot/);
  });
});

describe("receiveMeasurement", () => {
  it("maps the database refusal to a plain message", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({ code: "42501" });

    expect((await receiveMeasurement(LOG)).error).toMatch(
      /salesperson it was sent to/,
    );
  });
});

describe("cancelShootRequest", () => {
  it("lets the person who asked cancel an open request", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const { update } = fakeSupabase();

    expect(await cancelShootRequest(REQUEST, ME)).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith({ status: "cancelled" });
  });

  it("refuses someone else's request without touching the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const { update } = fakeSupabase();

    const result = await cancelShootRequest(REQUEST, "someone-else");

    expect(result.error).toMatch(/Only whoever asked/);
    expect(update).not.toHaveBeenCalled();
  });

  it("reports a request that is already shot or cancelled", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    fakeSupabase(null, []);

    expect((await cancelShootRequest(REQUEST, ME)).error).toMatch(
      /Could not find that request/,
    );
  });
});
