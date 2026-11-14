import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { recordLeftover, updateLeftover } from "./actions";

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
const LEFTOVER = "66666666-6666-4666-8666-666666666666";

const profile = (
  jobRole: Profile["jobRole"],
  arrangesStock = false,
): Profile => ({
  id: ME,
  fullName: "Awal",
  role: "staff",
  jobRole,
  arrangesStock,
  sells: false,
  seesMargin: false,
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

const recordFields = (fields: Record<string, string> = {}) =>
  form({
    mofId: MOF,
    item: " Carpet tile 50x50, Grey ",
    qty: "6",
    unit: "box",
    condition: "good",
    destination: "supplier",
    note: "",
    ...fields,
  });

const updateFields = (fields: Record<string, string> = {}) =>
  form({
    leftoverId: LEFTOVER,
    condition: "good",
    destination: "supplier",
    status: "returned_to_supplier",
    creditNoteNo: " CN-2026-0412 ",
    creditNoteAmount: "1,234.50",
    note: "",
    ...fields,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("recordLeftover", () => {
  it("lets a site supervisor record an item, always waiting for pickup", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase({ data: null, error: null });

    const result = await recordLeftover(recordFields());

    expect(result).toEqual({ error: null });
    expect(calls[0]).toEqual({
      name: "leftovers",
      payload: {
        mof_id: MOF,
        item: "Carpet tile 50x50, Grey",
        qty: 6,
        unit: "box",
        condition: "good",
        destination: "supplier",
        status: "pending_pickup",
        note: null,
      },
    });
  });

  it("lets a salesperson who arranges stock record", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales", true));
    fakeSupabase({ data: null, error: null });

    expect(await recordLeftover(recordFields())).toEqual({ error: null });
  });

  it("refuses other roles before touching the database", async () => {
    for (const role of ["sales", "accounts", "bd"] as const) {
      vi.mocked(getCurrentProfile).mockResolvedValue(profile(role));
      const calls = fakeSupabase();

      const result = await recordLeftover(recordFields());

      expect(result.error).toMatch(/Only a site supervisor/);
      expect(calls).toHaveLength(0);
    }
  });

  it("rejects a missing item and a zero quantity", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    const calls = fakeSupabase();

    expect((await recordLeftover(recordFields({ item: "  " }))).error).toMatch(
      /Enter the item/,
    );
    expect((await recordLeftover(recordFields({ qty: "0" }))).error).toMatch(
      /above zero/,
    );
    expect((await recordLeftover(recordFields({ qty: "" }))).error).toMatch(
      /above zero|quantity/,
    );
    expect(calls).toHaveLength(0);
  });

  it("shows a plain message when the database refuses", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("site"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fakeSupabase({ data: null, error: { code: "42501" } });

    expect((await recordLeftover(recordFields())).error).toMatch(
      /Only a site supervisor/,
    );
  });
});

describe("updateLeftover", () => {
  it("saves a supplier return with its credit note", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase({
      data: [{ id: LEFTOVER, mof_id: MOF }],
      error: null,
    });

    const result = await updateLeftover(updateFields());

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toEqual({
      condition: "good",
      destination: "supplier",
      status: "returned_to_supplier",
      note: null,
      credit_note_no: "CN-2026-0412",
      credit_note_amount: 1234.5,
    });
  });

  it("does not need the credit note to mark an item returned", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
    const calls = fakeSupabase({
      data: [{ id: LEFTOVER, mof_id: MOF }],
      error: null,
    });

    const result = await updateLeftover(
      updateFields({ creditNoteNo: "", creditNoteAmount: "" }),
    );

    expect(result).toEqual({ error: null });
    expect(calls[0]?.payload).toMatchObject({
      credit_note_no: null,
      credit_note_amount: null,
    });
  });

  it("refuses a credit note on stock GQ keeps, and a return for it", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase();

    const withNote = await updateLeftover(
      updateFields({ destination: "gq", status: "at_best_link" }),
    );
    const returned = await updateLeftover(
      updateFields({
        destination: "gq",
        creditNoteNo: "",
        creditNoteAmount: "",
      }),
    );

    expect(withNote.error).toMatch(/credit note only applies/i);
    expect(returned.error).toMatch(/stay with GQ/);
    expect(calls).toHaveLength(0);
  });

  it("needs the number when an amount is keyed in, and a real amount", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const calls = fakeSupabase();

    expect(
      (await updateLeftover(updateFields({ creditNoteNo: "" }))).error,
    ).toMatch(/credit note number/);
    expect(
      (await updateLeftover(updateFields({ creditNoteAmount: "abc" }))).error,
    ).toMatch(/amount/);
    expect(calls).toHaveLength(0);
  });

  it("refuses people who do not arrange stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const calls = fakeSupabase();

    const result = await updateLeftover(updateFields());

    expect(result.error).toMatch(/Only the people who arrange stock/);
    expect(calls).toHaveLength(0);
  });

  it("says so when the item no longer exists", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    fakeSupabase({ data: [], error: null });

    expect((await updateLeftover(updateFields())).error).toMatch(
      /Could not find that item/,
    );
  });
});
