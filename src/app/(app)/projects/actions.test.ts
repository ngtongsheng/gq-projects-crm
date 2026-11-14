import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "./actions";

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
const ARUN = "22222222-2222-4222-8222-222222222222";
const MEI = "33333333-3333-4333-8333-333333333333";
const CONTACT = "44444444-4444-4444-8444-444444444444";
const PROJECT = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

type Result = { data: unknown; error: { code?: string } | null };
type Call = { table: string; steps: string[]; payload: unknown };

/** Each query answers with the next queued result; calls are recorded. */
function fakeSupabase(results: Result[]) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { table, steps: [], payload: undefined };
      calls.push(call);
      const result = results.shift() ?? { data: null, error: null };
      const query: Record<string, unknown> = {};
      for (const step of [
        "select",
        "insert",
        "update",
        "eq",
        "is",
        "maybeSingle",
      ]) {
        query[step] = (payload?: unknown) => {
          call.steps.push(step);
          if (step === "insert" || step === "update") call.payload = payload;
          if (step === "maybeSingle") return Promise.resolve(result);
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
  for (const [key, value] of Object.entries({
    contactId: CONTACT,
    name: "Menara Ilham L12 office",
    leadSource: "archidex",
    stage: "lead",
    qtySqft: "900",
    value: "65,000",
    picId: ME,
    supportId: "",
    commissionType: "own",
    passedBy: "",
    nextAction: "Send catalogue",
    nextActionDate: "2026-11-05",
    notes: "",
    ...fields,
  })) {
    data.set(key, value);
  }
  return data;
}

const customer = (
  owners: string[],
  accountType = "own",
  passedBy: string | null = null,
): Result => ({
  data: {
    account_type: accountType,
    passed_by: passedBy,
    contact_owners: owners.map((profile_id) => ({ profile_id })),
  },
  error: null,
});

const existing = (picId: string, supportId: string | null = null): Result => ({
  data: {
    contact_id: CONTACT,
    pic_id: picId,
    support_id: supportId,
    commission_type: "own",
    passed_by: null,
  },
  error: null,
});
const updated: Result = { data: [{ id: PROJECT }], error: null };
const saved: Result = { data: null, error: null };

describe("saveProject: new project", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("registers the project to the signed-in owner with value in RM", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([customer([ME]), saved]);

    const result = await saveProject(form({}));

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toMatchObject({
      contact_id: CONTACT,
      name: "Menara Ilham L12 office",
      lead_source: "archidex",
      stage: "lead",
      qty_sqft: 900,
      value: 65000,
      pic_id: ME,
      support_id: null,
      commission_type: "own",
      next_action: "Send catalogue",
      next_action_date: "2026-11-05",
      notes: null,
    });
    expect(calls[1]?.payload).not.toHaveProperty("stage_changed_at");
  });

  it("makes a salesperson the PIC and ignores a PIC picked in the form", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([customer([ME]), saved]);

    await saveProject(form({ picId: ARUN }));

    expect(calls[1]?.payload).toMatchObject({ pic_id: ME });
  });

  it("starts on the customer's commission type, whatever the form says", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([customer([ME], "pass_down", ARUN), saved]);

    await saveProject(form({ commissionType: "own", passedBy: "" }));

    expect(calls[1]?.payload).toMatchObject({
      commission_type: "pass_down",
      passed_by: ARUN,
    });
  });

  it("lets the Sales Director choose the PIC and commission type", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("director"));
    const calls = fakeSupabase([customer([ARUN]), saved]);

    const result = await saveProject(
      form({ picId: MEI, commissionType: "company" }),
    );

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toMatchObject({
      pic_id: MEI,
      commission_type: "company",
    });
  });

  it("refuses a salesperson who does not own the customer", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([customer([ARUN])]);

    const result = await saveProject(form({}));

    expect(result.error).toMatch(/owners/);
    expect(calls).toHaveLength(1);
  });

  it("lets HR & Accounts read but not add", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase([customer([ME])]);

    const result = await saveProject(form({}));

    expect(result.error).toMatch(/owners/);
    expect(calls).toHaveLength(1);
  });
});

describe("saveProject: validation", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
  });

  it.each([
    ["a blank name", { name: "  " }, /project name/],
    ["no lead source", { leadSource: "" }, /lead came from/],
    ["an unknown stage", { stage: "won" }, /./],
    ["a value that is not an amount", { value: "lots" }, /amount/],
    ["a negative value", { value: "-5" }, /negative/],
    ["a quantity that is not a number", { qtySqft: "many" }, /number/],
    ["a bad next action date", { nextActionDate: "2026-13-40" }, /date/],
    ["the PIC as supporting person", { supportId: ME }, /someone other/],
  ])("refuses %s", async (_label, fields, message) => {
    const calls = fakeSupabase([customer([ME]), saved]);

    const result = await saveProject(form(fields));

    expect(result.error).toMatch(message);
    expect(calls.filter((call) => call.steps.includes("insert"))).toHaveLength(
      0,
    );
  });

  it("treats a blank value and quantity as zero", async () => {
    const calls = fakeSupabase([customer([ME]), saved]);

    await saveProject(form({ value: "", qtySqft: "" }));

    expect(calls[1]?.payload).toMatchObject({ value: 0, qty_sqft: 0 });
  });
});

describe("saveProject: existing project", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
  });

  it("leaves the stage clock to the database", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ME), updated]);

    const result = await saveProject(
      form({ projectId: PROJECT, stage: "quotation_sent", value: "70000" }),
    );

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toMatchObject({
      stage: "quotation_sent",
      value: 70000,
    });
    expect(calls[1]?.payload).not.toHaveProperty("stage_changed_at");
  });

  it("does not let the supporting salesperson take over as PIC", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ARUN, ME), updated]);

    await saveProject(form({ projectId: PROJECT, picId: ME }));

    expect(calls[1]?.payload).toMatchObject({ pic_id: ARUN });
    expect(calls[1]?.payload).not.toHaveProperty("contact_id");
  });

  it("refuses a salesperson who is neither PIC nor supporting", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase([existing(ARUN, MEI)]);

    const result = await saveProject(form({ projectId: PROJECT }));

    expect(result.error).toMatch(/person in charge/);
    expect(calls).toHaveLength(1);
  });

  it("lets the MD edit anyone's project and reassign the PIC", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase([existing(ARUN), updated]);

    const result = await saveProject(form({ projectId: PROJECT, picId: MEI }));

    expect(result.error).toBeNull();
    expect(calls[1]?.payload).toMatchObject({ pic_id: MEI });
  });

  it("lets HR & Accounts read but not change", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase([existing(ME)]);

    const result = await saveProject(form({ projectId: PROJECT }));

    expect(result.error).toMatch(/person in charge/);
    expect(calls).toHaveLength(1);
  });

  it("reports a project that is gone", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([{ data: null, error: null }]);

    const result = await saveProject(form({ projectId: PROJECT }));

    expect(result.error).toMatch(/Reload/);
  });

  it("reports a change the database refused", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase([existing(ME), { data: [], error: null }]);

    const result = await saveProject(form({ projectId: PROJECT }));

    expect(result.error).toMatch(/person in charge/);
  });
});
