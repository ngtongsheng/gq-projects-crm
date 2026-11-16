import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { resetEntitlement, saveEntitlement } from "./entitlement-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ANNA = "11111111-1111-4111-8111-111111111111";

const signedInAs = (jobRole: Profile["jobRole"]) =>
  vi.mocked(requirePage).mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    fullName: "Someone",
    role: "staff",
    jobRole,
    arrangesStock: false,
    sells: false,
    seesMargin: false,
    commissionMode: "standard",
    yearlyTarget: null,
    language: "en",
  });

type Result = { data: unknown; error: { code?: string } | null };
type Call = { op: string; payload: unknown; filters: unknown[][] };

/** Each query takes the next result in line; the calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const client = {
    from: vi.fn(() => {
      const call: Call = { op: "select", payload: undefined, filters: [] };
      calls.push(call);
      const result = queue.shift() ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      const chain = () => Object.assign(Promise.resolve(result), query);
      for (const op of ["insert", "update", "delete"]) {
        query[op] = (payload?: unknown) => {
          call.op = op;
          call.payload = payload;
          return chain();
        };
      }
      query.select = chain;
      query.eq = (...args: unknown[]) => {
        call.filters.push(args);
        return chain();
      };
      return query;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return calls;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const entitlement = (over: Record<string, string> = {}) =>
  form({
    personId: ANNA,
    year: "2027",
    annualDays: "16",
    carriedDays: "3.5",
    mcDays: "14",
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs("accounts");
});

describe("saveEntitlement", () => {
  it("changes the existing row for the person and year", async () => {
    const calls = fakeSupabase({ data: [{ profile_id: ANNA }], error: null });
    expect(await saveEntitlement(entitlement())).toEqual({ error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      op: "update",
      payload: { annual_days: 16, carried_days: 3.5, mc_days: 14 },
      filters: [
        ["profile_id", ANNA],
        ["year", 2027],
      ],
    });
  });

  it("adds the row when the person is still on the company default", async () => {
    const calls = fakeSupabase(
      { data: [], error: null },
      { data: null, error: null },
    );
    expect(await saveEntitlement(entitlement({ carriedDays: "" }))).toEqual({
      error: null,
    });
    expect(calls[1]).toMatchObject({
      op: "insert",
      payload: {
        profile_id: ANNA,
        year: 2027,
        annual_days: 16,
        carried_days: 0,
        mc_days: 14,
      },
    });
  });

  it("changes the row again when another save added it first", async () => {
    const calls = fakeSupabase(
      { data: [], error: null },
      { data: null, error: { code: "23505" } },
      { data: [{ profile_id: ANNA }], error: null },
    );
    expect(await saveEntitlement(entitlement())).toEqual({ error: null });
    expect(calls.map((call) => call.op)).toEqual([
      "update",
      "insert",
      "update",
    ]);
    expect(calls[2]).toMatchObject({
      payload: { annual_days: 16, carried_days: 3.5, mc_days: 14 },
      filters: [
        ["profile_id", ANNA],
        ["year", 2027],
      ],
    });
  });

  it("maps the error as before when the second change fails too", async () => {
    fakeSupabase(
      { data: [], error: null },
      { data: null, error: { code: "23505" } },
      { data: null, error: { code: "42501" } },
    );
    expect((await saveEntitlement(entitlement())).error).toMatch(/Only the/);
  });

  it("asks to try again when the row is gone for the second change", async () => {
    fakeSupabase(
      { data: [], error: null },
      { data: null, error: { code: "23505" } },
      { data: [], error: null },
    );
    expect((await saveEntitlement(entitlement())).error).toBe(
      "Could not save. Try again.",
    );
  });

  it.each([
    ["a quarter day", { annualDays: "14.25" }],
    ["a negative number", { carriedDays: "-1" }],
    ["text", { mcDays: "lots" }],
    ["a year before balances start", { year: "2026" }],
  ])("refuses %s without touching the database", async (_name, over) => {
    const calls = fakeSupabase();
    const result = await saveEntitlement(entitlement(over));
    expect(result.error).not.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([
    "director",
    "sales",
    "site",
  ] as const)("refuses a %s", async (jobRole) => {
    signedInAs(jobRole);
    const calls = fakeSupabase();
    expect((await saveEntitlement(entitlement())).error).toMatch(/Only the/);
    expect(calls).toHaveLength(0);
  });

  it("lets the Managing Director save", async () => {
    signedInAs("md");
    fakeSupabase({ data: [{ profile_id: ANNA }], error: null });
    expect(await saveEntitlement(entitlement())).toEqual({ error: null });
  });

  it("shows a plain message when the database refuses", async () => {
    fakeSupabase({ data: null, error: { code: "42501" } });
    expect((await saveEntitlement(entitlement())).error).toMatch(/Only the/);
  });
});

describe("resetEntitlement", () => {
  it("deletes the override so the company default applies again", async () => {
    const calls = fakeSupabase({ data: null, error: null });
    expect(
      await resetEntitlement(form({ personId: ANNA, year: "2027" })),
    ).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      op: "delete",
      filters: [
        ["profile_id", ANNA],
        ["year", 2027],
      ],
    });
  });

  it("refuses people who may not edit", async () => {
    signedInAs("director");
    const calls = fakeSupabase();
    const result = await resetEntitlement(
      form({ personId: ANNA, year: "2027" }),
    );
    expect(result.error).toMatch(/Only the/);
    expect(calls).toHaveLength(0);
  });
});
