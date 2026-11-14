import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { answerBooking, requestBooking } from "./booking-actions";

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
const SUPERVISOR = "88888888-8888-4888-8888-888888888888";
const PROJECT = "99999999-9999-4999-8999-999999999999";
const BOOKING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { table: string; payload: unknown; filters: [string, unknown][] };

/** Each query takes the next result in line; calls are recorded in order. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, payload: undefined, filters: [] };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
          if (step === "insert" || step === "update") call.payload = args[0];
          if (step === "eq") call.filters.push([String(args[0]), args[1]]);
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
    supervisorId: SUPERVISOR,
    purpose: "site_measurement",
    visitOn: "2026-11-12",
    startTime: "10:00",
    projectId: PROJECT,
    site: "",
    notes: " Bring the sample ",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const saved: Result = { data: [], error: null };
const one: Result = { data: [{ id: BOOKING }], error: null };

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
});

describe("requestBooking", () => {
  it("books a supervisor for a project; the database starts it Requested", async () => {
    const calls = fakeSupabase([saved]);

    const result = await requestBooking(form());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.table).toBe("site_bookings");
    expect(calls[0]?.payload).toEqual({
      supervisor_id: SUPERVISOR,
      purpose: "site_measurement",
      visit_on: "2026-11-12",
      start_time: "10:00",
      project_id: PROJECT,
      site: null,
      notes: "Bring the sample",
    });
  });

  it("books a typed site when no project is chosen", async () => {
    const calls = fakeSupabase([saved]);

    await requestBooking(
      form({ projectId: "", site: " Mont Kiara show unit " }),
    );

    expect(calls[0]?.payload).toMatchObject({
      project_id: null,
      site: "Mont Kiara show unit",
    });
  });

  it("needs a project or a site", async () => {
    const calls = fakeSupabase([saved]);

    const result = await requestBooking(form({ projectId: "" }));

    expect(result.error).toBe("Choose a project or type the site.");
    expect(calls).toHaveLength(0);
  });

  it.each([
    "support",
    "site",
    "accounts",
  ] as const)("refuses a %s", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = fakeSupabase([saved]);

    const result = await requestBooking(form());

    expect(result.error).toMatch(/can book a site supervisor/);
    expect(calls).toHaveLength(0);
  });

  it("rejects a bad purpose or time", async () => {
    fakeSupabase([saved]);

    expect((await requestBooking(form({ purpose: "party" }))).error).toBe(
      "Choose the purpose.",
    );
    expect((await requestBooking(form({ startTime: "25:00" }))).error).toBe(
      "Enter the time as HH:MM.",
    );
  });

  it("tells her when the database refuses a person who is not a supervisor", async () => {
    fakeSupabase([
      {
        data: null,
        error: {
          code: "23514",
          message: "You can only book a Site Supervisor.",
        },
      },
    ]);

    const result = await requestBooking(form());

    expect(result.error).toBe("You can only book a site supervisor.");
  });
});

describe("answerBooking", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
  });

  it("confirms only a booking made for the signed-in supervisor", async () => {
    const calls = fakeSupabase([one]);

    const result = await answerBooking(BOOKING, "confirmed", "");

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({
      status: "confirmed",
      decline_reason: null,
    });
    expect(calls[0]?.filters).toEqual([
      ["id", BOOKING],
      ["supervisor_id", ME],
      ["status", "requested"],
    ]);
  });

  it("keeps the reason when declining and leaves it blank when optional", async () => {
    const calls = fakeSupabase([one, one]);

    await answerBooking(BOOKING, "declined", " Can do 2pm instead ");
    await answerBooking(BOOKING, "declined", "");

    expect(calls[0]?.payload).toEqual({
      status: "declined",
      decline_reason: "Can do 2pm instead",
    });
    expect(calls[1]?.payload).toEqual({
      status: "declined",
      decline_reason: null,
    });
  });

  it("drops a reason typed for a confirmation", async () => {
    const calls = fakeSupabase([one]);

    await answerBooking(BOOKING, "confirmed", "ignored");

    expect(calls[0]?.payload).toMatchObject({ decline_reason: null });
  });

  it.each([
    "sales",
    "support",
    "md",
    "director",
  ] as const)("refuses a %s, who cannot answer a booking", async (jobRole) => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
    const calls = fakeSupabase([one]);

    const result = await answerBooking(BOOKING, "confirmed", "");

    expect(result.error).toBe(
      "Only the booked site supervisor can answer a booking.",
    );
    expect(calls).toHaveLength(0);
  });

  it("says not found when the booking is someone else's or already answered", async () => {
    fakeSupabase([saved]);

    const result = await answerBooking(BOOKING, "confirmed", "");

    expect(result.error).toMatch(/Could not find that booking/);
  });

  it("rejects a request to put a booking back to Requested", async () => {
    const calls = fakeSupabase([one]);

    const result = await answerBooking(BOOKING, "requested" as "confirmed", "");

    expect(result.error).toBe("Confirm or decline.");
    expect(calls).toHaveLength(0);
  });
});
