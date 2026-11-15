import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveInstaller } from "./installer-actions";

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

const INSTALLER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const profile = (
  jobRole: Profile["jobRole"],
  arrangesStock = false,
): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Wai Mun",
  role: "staff",
  jobRole,
  arrangesStock,
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
type Call = { steps: string[]; payload: unknown; filters: [string, unknown][] };

/** Each query takes the next result in line; calls are recorded in order. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn(() => {
      const call: Call = { steps: [], payload: undefined, filters: [] };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
          call.steps.push(step);
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

function form(fields: Record<string, string> = {}, skills = ["Timber"]) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    installerId: "",
    name: "  Ahmad   Razak ",
    company: " KV Flooring ",
    phone: "012-345 6789",
    phone2: "",
    description: "",
    area: "Penang",
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  for (const skill of skills) data.append("skills", skill);
  return data;
}

const saved: Result = { data: [], error: null };

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockReset();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("saveInstaller", () => {
  it("adds an active installer with tidy text and blank fields as null", async () => {
    const calls = fakeSupabase([saved]);

    const result = await saveInstaller(form());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["insert"]);
    expect(calls[0]?.payload).toEqual({
      name: "Ahmad Razak",
      company: "KV Flooring",
      phone: "012-345 6789",
      phone2: null,
      skills: ["Timber"],
      description: null,
      area: "Penang",
      notes: null,
      active: true,
    });
  });

  it("saves changes to the installer picked, including making them inactive", async () => {
    const calls = fakeSupabase([{ data: [{ id: INSTALLER }], error: null }]);

    const result = await saveInstaller(form({ installerId: INSTALLER }));

    expect(result).toEqual({ error: null });
    expect(calls[0]?.steps).toEqual(["update", "eq", "select"]);
    expect(calls[0]?.filters).toEqual([["id", INSTALLER]]);
    expect(calls[0]?.payload).toMatchObject({ active: false });
  });

  it("keeps an installer active when the tick stays on", async () => {
    const calls = fakeSupabase([{ data: [{ id: INSTALLER }], error: null }]);

    await saveInstaller(form({ installerId: INSTALLER, active: "on" }));

    expect(calls[0]?.payload).toMatchObject({ active: true });
  });

  it("asks for the name and the phone number", async () => {
    const calls = fakeSupabase([saved]);

    expect(await saveInstaller(form({ name: "   " }))).toEqual({
      error: "Key in the name.",
    });
    expect(await saveInstaller(form({ phone: "" }))).toEqual({
      error: "Key in the phone number.",
    });
    expect(calls).toHaveLength(0);
  });

  it("refuses a skill that is not on the list", async () => {
    const calls = fakeSupabase([saved]);

    const result = await saveInstaller(form({}, ["Plumbing"]));

    expect(result.error).toBe("Choose skills from the list.");
    expect(calls).toHaveLength(0);
  });

  it("says so when the name is already in the list", async () => {
    fakeSupabase([{ data: null, error: { code: "23505" } }]);

    expect(await saveInstaller(form())).toEqual({
      error: "Ahmad Razak is already in the list.",
    });
  });

  it("reports an installer that is gone or hidden", async () => {
    fakeSupabase([{ data: [], error: null }]);

    const result = await saveInstaller(form({ installerId: INSTALLER }));

    expect(result.error).toContain("Could not find that installer");
  });

  it("lets whoever arranges stock edit, but not sales or HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales", true));
    fakeSupabase([saved]);
    expect(await saveInstaller(form())).toEqual({ error: null });

    for (const jobRole of ["sales", "accounts", "bd"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(jobRole));
      const calls = fakeSupabase([saved]);
      const result = await saveInstaller(form());
      expect(result.error).toContain("Only the MD");
      expect(calls).toHaveLength(0);
    }
  });
});
