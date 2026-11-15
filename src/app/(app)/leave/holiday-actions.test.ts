import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "@/lib/auth/current-profile";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { addHoliday, removeHoliday } from "./holiday-actions";

vi.mock("@/lib/auth/require-page", () => ({ requirePage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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

type Call = {
  op: string;
  payload: unknown;
  options: unknown;
  filters: unknown[][];
};

function fakeSupabase(error: { code?: string } | null = null) {
  const calls: Call[] = [];
  const client = {
    from: vi.fn(() => {
      const call: Call = {
        op: "",
        payload: undefined,
        options: undefined,
        filters: [],
      };
      calls.push(call);
      const query: Record<string, unknown> = {};
      const done = () =>
        Object.assign(Promise.resolve({ data: null, error }), query);
      query.upsert = (payload: unknown, options: unknown) => {
        Object.assign(call, { op: "upsert", payload, options });
        return done();
      };
      query.delete = () => {
        call.op = "delete";
        return done();
      };
      query.eq = (...args: unknown[]) => {
        call.filters.push(args);
        return done();
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

beforeEach(() => {
  vi.clearAllMocks();
  signedInAs("md");
});

describe("addHoliday", () => {
  it("saves the day with its trimmed name, replacing one already on that day", async () => {
    const calls = fakeSupabase();
    const result = await addHoliday(
      form({ day: "2027-01-01", name: "  New Year  " }),
    );
    expect(result).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      op: "upsert",
      payload: { day: "2027-01-01", name: "New Year" },
      options: { onConflict: "day" },
    });
  });

  it("asks for a name", async () => {
    const calls = fakeSupabase();
    const result = await addHoliday(form({ day: "2027-01-01", name: "  " }));
    expect(result).toEqual({ error: "Key in the name." });
    expect(calls).toHaveLength(0);
  });

  it("asks for a real date", async () => {
    fakeSupabase();
    expect((await addHoliday(form({ day: "", name: "X" }))).error).toBe(
      "Choose the date.",
    );
  });

  it("refuses anyone but the Managing Director and HR & Accounts", async () => {
    signedInAs("director");
    const calls = fakeSupabase();
    const result = await addHoliday(
      form({ day: "2027-01-01", name: "New Year" }),
    );
    expect(result.error).toMatch(/Only the/);
    expect(calls).toHaveLength(0);
  });

  it("lets HR & Accounts add", async () => {
    signedInAs("accounts");
    fakeSupabase();
    expect(
      await addHoliday(form({ day: "2027-01-01", name: "New Year" })),
    ).toEqual({
      error: null,
    });
  });
});

describe("removeHoliday", () => {
  it("deletes by day", async () => {
    const calls = fakeSupabase();
    expect(await removeHoliday("2027-12-25")).toEqual({ error: null });
    expect(calls[0]).toMatchObject({
      op: "delete",
      filters: [["day", "2027-12-25"]],
    });
  });

  it("refuses a day that is not a date", async () => {
    const calls = fakeSupabase();
    expect((await removeHoliday("tomorrow")).error).not.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("refuses someone who may not edit", async () => {
    signedInAs("sales");
    const calls = fakeSupabase();
    expect((await removeHoliday("2027-12-25")).error).toMatch(/Only the/);
    expect(calls).toHaveLength(0);
  });
});
