import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  extendReservation,
  moveReservation,
  reserveStock,
  saveStockItem,
  saveStockSettings,
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
vi.mock("./stock-settings", () => ({
  loadStockSettings: vi.fn(async () => ({ holdDays: 14, warningDays: 3 })),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const SALESPERSON = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const PROJECT = "44444444-4444-4444-8444-444444444444";
const LINE = "55555555-5555-4555-8555-555555555555";

const profile = (
  jobRole: Profile["jobRole"],
  overrides: Partial<Profile> = {},
): Profile => ({
  id: ME,
  fullName: "Sarah",
  role: "staff",
  jobRole,
  arrangesStock: false,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
  ...overrides,
});

type Result = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
type Call = { name: string; payload: unknown; filters: unknown[][] };

/** Each query takes the next result in line; calls are recorded. */
function fakeSupabase(...results: Result[]) {
  const calls: Call[] = [];
  const queue = [...results];
  const next = () => queue.shift() ?? { data: [], error: null };
  const client = {
    from: vi.fn((table: string) => {
      const call: Call = { name: table, payload: undefined, filters: [] };
      calls.push(call);
      const result = next();
      const query: Record<string, unknown> = {};
      for (const step of ["insert", "update", "upsert", "eq", "select"]) {
        query[step] = (...args: unknown[]) => {
          if (step === "insert" || step === "update" || step === "upsert") {
            call.payload = args[0];
          }
          if (step === "eq") call.filters.push(args);
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

const reserveFields = (fields: Record<string, string> = {}) =>
  form({
    itemId: ITEM,
    projectId: PROJECT,
    qty: "12.5",
    reservedBy: "",
    note: "",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("reserveStock", () => {
  it("sends a salesperson's ask as a request in their own name", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await reserveStock(
      reserveFields({ reservedBy: SALESPERSON }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({
      item_id: ITEM,
      project_id: PROJECT,
      qty: 12.5,
      reserved_by: ME,
      note: null,
      status: "requested",
    });
  });

  it("lets the people who arrange stock reserve straight away for a salesperson", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(
      profile("sales", { arrangesStock: true }),
    );
    const calls = fakeSupabase({ data: null, error: null });

    await reserveStock(reserveFields({ reservedBy: SALESPERSON }));

    const today = todayMyt();
    expect(calls[0]?.payload).toMatchObject({
      status: "reserved",
      reserved_by: SALESPERSON,
      reserved_at: today,
    });
    const expires = (calls[0]?.payload as { expires_on: string }).expires_on;
    expect(expires > today).toBe(true);
  });

  it("refuses HR & Accounts, who can see stock but not reserve it", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    const calls = fakeSupabase();

    const result = await reserveStock(reserveFields());

    expect(result.error).toMatch(/Only salespeople/);
    expect(calls).toHaveLength(0);
  });

  it("rejects a zero quantity and a bad item", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    expect((await reserveStock(reserveFields({ qty: "0" }))).error).toMatch(
      /above zero/,
    );
    expect(
      (await reserveStock(reserveFields({ itemId: "nope" }))).error,
    ).toMatch(/Could not find that stock item/);
    expect(calls).toHaveLength(0);
  });

  it("passes on how much is left when the database refuses a hold", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    fakeSupabase({
      data: null,
      error: { code: "23514", message: "Only 4 left of this stock." },
    });

    expect((await reserveStock(reserveFields())).error).toBe(
      "Only 4 left of this stock.",
    );
  });

  it("says why when a salesperson reserves for a project that is not theirs", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeSupabase({ data: null, error: { code: "42501" } });

    expect((await reserveStock(reserveFields())).error).toMatch(
      /project you own or support/,
    );
  });
});

describe("moveReservation", () => {
  it("confirms a request and starts the hold", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase(
      { data: [{ status: "requested", expires_on: null }], error: null },
      { data: [{ id: LINE }], error: null },
    );

    const result = await moveReservation(
      form({ reservationId: LINE, to: "reserved" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[1]?.payload).toMatchObject({
      status: "reserved",
      reserved_at: todayMyt(),
    });
    expect(calls[1]?.filters).toContainEqual(["status", "requested"]);
  });

  it("moves a held line to released without touching its dates", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase(
      { data: [{ status: "reserved", expires_on: "2026-11-20" }], error: null },
      { data: [{ id: LINE }], error: null },
    );

    await moveReservation(form({ reservationId: LINE, to: "released" }));

    expect(calls[1]?.payload).toEqual({ status: "released" });
  });

  it("refuses a move the line cannot make", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({
      data: [{ status: "released", expires_on: "2026-11-20" }],
      error: null,
    });

    const result = await moveReservation(
      form({ reservationId: LINE, to: "reserved" }),
    );

    expect(result.error).toMatch(/changed this reservation first/);
    expect(calls).toHaveLength(1);
  });

  it("tells the user when someone else moved the line first", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase(
      { data: [{ status: "requested", expires_on: null }], error: null },
      { data: [], error: null },
    );

    expect(
      (await moveReservation(form({ reservationId: LINE, to: "reserved" })))
        .error,
    ).toMatch(/changed this reservation first/);
  });

  it("refuses people who do not arrange stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    const result = await moveReservation(
      form({ reservationId: LINE, to: "reserved" }),
    );

    expect(result.error).toMatch(/Only the people who arrange stock/);
    expect(calls).toHaveLength(0);
  });
});

describe("extendReservation", () => {
  it("adds the hold days to a hold still running", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const future = "2099-01-01";
    const calls = fakeSupabase(
      { data: [{ status: "reserved", expires_on: future }], error: null },
      { data: [{ id: LINE }], error: null },
    );

    await extendReservation(form({ reservationId: LINE }));

    expect(calls[1]?.payload).toEqual({ expires_on: "2099-01-15" });
  });

  it("restarts a lapsed hold from today", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase(
      {
        data: [{ status: "po_issued", expires_on: "2020-01-01" }],
        error: null,
      },
      { data: [{ id: LINE }], error: null },
    );

    await extendReservation(form({ reservationId: LINE }));

    const expires = (calls[1]?.payload as { expires_on: string }).expires_on;
    expect(expires > todayMyt()).toBe(true);
  });

  it("does not extend a request", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({
      data: [{ status: "requested", expires_on: null }],
      error: null,
    });

    expect(
      (await extendReservation(form({ reservationId: LINE }))).error,
    ).toMatch(/changed this reservation first/);
    expect(calls).toHaveLength(1);
  });
});

describe("saveStockItem", () => {
  const itemFields = (fields: Record<string, string> = {}) =>
    form({
      itemId: "",
      sku: " FTP-227-702 ",
      supplier: "Floor Place",
      collection: "",
      qty: "40",
      unit: "box",
      ...fields,
    });

  it("adds an item", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({ data: [{ id: ITEM }], error: null });

    expect(await saveStockItem(itemFields())).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({
      sku: "FTP-227-702",
      supplier: "Floor Place",
      collection: null,
      qty: 40,
      unit: "box",
    });
  });

  it("changes an item without touching its unit", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({ data: [{ id: ITEM }], error: null });

    await saveStockItem(itemFields({ itemId: ITEM, unit: "pcs", qty: "35" }));

    expect(calls[0]?.payload).toEqual({
      sku: "FTP-227-702",
      supplier: "Floor Place",
      collection: null,
      qty: 35,
    });
  });

  it("says so when the SKU is already in stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeSupabase({ data: null, error: { code: "23505" } });

    expect((await saveStockItem(itemFields())).error).toMatch(
      /already in stock/,
    );
  });

  it("refuses people who do not arrange stock, and a negative quantity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();
    expect((await saveStockItem(itemFields())).error).toMatch(
      /Only the people who arrange stock/,
    );

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    expect((await saveStockItem(itemFields({ qty: "-1" }))).error).toMatch(
      /cannot be negative/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("saveStockSettings", () => {
  const settingsFields = (fields: Record<string, string> = {}) =>
    form({ holdDays: "21", warningDays: "5", ...fields });

  it("lets the MD and an admin save", async () => {
    for (const me of [profile("md"), profile("sales", { role: "admin" })]) {
      vi.mocked(getCurrentProfile).mockResolvedValue(me);
      const calls = fakeSupabase({ data: null, error: null });

      expect(await saveStockSettings(settingsFields())).toEqual({
        error: null,
      });
      expect(calls[0]?.payload).toEqual([
        { key: "stock_hold_days", value: 21 },
        { key: "stock_warning_days", value: 5 },
      ]);
    }
  });

  it("refuses everyone else and nonsense values", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase();
    expect((await saveStockSettings(settingsFields())).error).toMatch(
      /Only the MD or an admin/,
    );

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    expect(
      (await saveStockSettings(settingsFields({ holdDays: "0" }))).error,
    ).toMatch(/at least 1 day/);
    expect(
      (await saveStockSettings(settingsFields({ warningDays: "1.5" }))).error,
    ).toMatch(/whole number/);
    expect(calls).toHaveLength(0);
  });
});
