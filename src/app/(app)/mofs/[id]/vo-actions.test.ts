import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveVariationOrder } from "./vo-actions";

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

const MOF = "33333333-3333-4333-8333-333333333333";
const VO = "44444444-4444-4444-8444-444444444444";
const SUPERVISOR = "55555555-5555-4555-8555-555555555555";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Wai Mun",
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

/** The rpc answers with the given result; its calls are recorded. */
function fakeSupabase(result: Result) {
  const calls: { name: string; payload: Record<string, unknown> }[] = [];
  const client = {
    rpc: vi.fn((name: string, payload: Record<string, unknown>) => {
      calls.push({ name, payload });
      return Promise.resolve(result);
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

function form(fields: Record<string, string> = {}, notify: string[] = []) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    mofId: MOF,
    voNo: " VO2 ",
    clientRef: "",
    confirmedOn: "2026-11-10",
    amount: "RM 1,250.50",
    description: " Extra carpet tile for pantry ",
    qty: "",
    needsWork: "on",
    ...fields,
  })) {
    data.set(key, value);
  }
  for (const id of notify) data.append("notifyId", id);
  return data;
}

/** An unticked checkbox is left out of the form. */
function withoutWork(data: FormData) {
  data.delete("needsWork");
  return data;
}

const reopened: Result = { data: true, error: null };

describe("saveVariationOrder", () => {
  beforeEach(() => {
    vi.mocked(getCurrentProfile).mockReset();
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
  });

  it("adds the VO with the supervisors to tell and reports a reopened job", async () => {
    const calls = fakeSupabase(reopened);

    const result = await saveVariationOrder(form({}, [SUPERVISOR]));

    expect(result).toEqual({ error: null, reopened: true });
    expect(calls).toEqual([
      {
        name: "save_variation_order",
        payload: {
          variation_order_id: null,
          mof_id: MOF,
          vo: {
            vo_no: "VO2",
            client_ref: null,
            confirmed_on: "2026-11-10",
            amount: 1250.5,
            description: "Extra carpet tile for pantry",
            qty: null,
            needs_work: true,
          },
          cost: null,
          notify: [SUPERVISOR],
        },
      },
    ]);
  });

  it("changes a saved VO, keeping an omission negative", async () => {
    const calls = fakeSupabase({ data: false, error: null });

    const result = await saveVariationOrder(
      withoutWork(form({ voId: VO, amount: "-400" })),
    );

    expect(result).toEqual({ error: null, reopened: false });
    expect(calls[0]?.payload).toMatchObject({
      variation_order_id: VO,
      vo: { amount: -400, needs_work: false },
    });
  });

  it("allows 0 only for additional work with no charge", async () => {
    fakeSupabase(reopened);
    expect((await saveVariationOrder(form({ amount: "0" }))).error).toBeNull();

    const calls = fakeSupabase(reopened);
    const result = await saveVariationOrder(withoutWork(form({ amount: "0" })));

    expect(result.error).toMatch(/0 only for additional work/);
    expect(calls).toHaveLength(0);
  });

  it("needs the date it was confirmed and what it is", async () => {
    const calls = fakeSupabase(reopened);

    expect((await saveVariationOrder(form({ confirmedOn: "" }))).error).toMatch(
      /date the VO was confirmed/,
    );
    expect(
      (await saveVariationOrder(form({ description: " " }))).error,
    ).toMatch(/what the additional work/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a Site Supervisor", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase(reopened);

    await expect(saveVariationOrder(form())).rejects.toThrow(
      "redirect:/not-allowed",
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses a Marketing Director, who may open the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("bd"));
    const calls = fakeSupabase(reopened);

    const result = await saveVariationOrder(form());

    expect(result.error).toMatch(/Only the MD, Purchasing or HR & Accounts/);
    expect(calls).toHaveLength(0);
  });

  it("sends the cost from a cost reader", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase(reopened);

    await saveVariationOrder(form({ cost: "RM 800" }));

    expect(calls[0]?.payload.cost).toBe(800);
  });

  it("shows the database's refusal to go below the payments received", async () => {
    const message =
      "The order total can't go below RM 1,200.00 already received.";
    fakeSupabase({ data: null, error: { code: "23514", message } });

    const result = await saveVariationOrder(form({ amount: "-500" }));

    expect(result.error).toBe(message);
  });

  it("reports a VO no. already used on the MOF", async () => {
    fakeSupabase({
      data: null,
      error: {
        code: "23505",
        message: "mof_variation_orders_mof_id_vo_no_key",
      },
    });

    const result = await saveVariationOrder(form());

    expect(result.error).toBe(
      "VO2 is already used on this MOF. Use the next VO no.",
    );
  });

  it("reports the database refusing the cost", async () => {
    fakeSupabase({
      data: null,
      error: {
        code: "42501",
        message:
          'new row violates row-level security policy for table "mof_variation_order_costs"',
      },
    });

    const result = await saveVariationOrder(form({ cost: "800" }));

    expect(result.error).toMatch(/see or set the cost/);
  });
});
