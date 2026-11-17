import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { deleteGiveaway, saveGiveaway } from "./marketing-giveaway-actions";

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
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const GIVEAWAY = "55555555-5555-4555-8555-555555555555";

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
  language: "en",
});

type Write = { op: string; row?: Record<string, unknown> };
const writes: Write[] = [];

function givenDatabase(
  change: { data?: unknown[]; error?: { code: string } | null } = {},
) {
  const done = (op: string, row?: Record<string, unknown>) => {
    writes.push({ op, row });
    const answer = {
      data: change.data ?? [{ id: GIVEAWAY }],
      error: change.error ?? null,
    };
    const chain = {
      eq: () => chain,
      select: () => Promise.resolve(answer),
    };
    return chain;
  };
  const client = {
    from: () => ({
      insert: (row: Record<string, unknown>) => done("insert", row),
      update: (row: Record<string, unknown>) => done("update", row),
      delete: () => done("delete"),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

const giveaway = {
  id: "",
  givenOn: "2026-11-17",
  supplier: " Mega Print ",
  invoiceNo: "",
  item: " Catalogue – Savoy ",
  givenTo: "Hannan Medicare",
  qty: "3",
  unitCost: "12.50",
};

beforeEach(() => {
  vi.resetAllMocks();
  writes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("saveGiveaway", () => {
  it("adds a line and leaves the total to the database", async () => {
    givenDatabase();
    expect(await saveGiveaway(giveaway)).toEqual({ error: null });
    expect(writes).toEqual([
      {
        op: "insert",
        row: {
          given_on: "2026-11-17",
          supplier: "Mega Print",
          invoice_no: null,
          item: "Catalogue – Savoy",
          given_to: "Hannan Medicare",
          qty: 3,
          unit_cost: 12.5,
        },
      },
    ]);
  });

  it("takes a quantity of 1 and a unit cost of 0 when left blank", async () => {
    givenDatabase();
    await saveGiveaway({ ...giveaway, qty: "", unitCost: "" });
    expect(writes[0]?.row).toMatchObject({ qty: 1, unit_cost: 0 });
  });

  it("saves changes to an existing line", async () => {
    givenDatabase();
    await saveGiveaway({ ...giveaway, id: GIVEAWAY });
    expect(writes[0]?.op).toBe("update");
  });

  it.each([
    ["date", { givenOn: "" }],
    ["item", { item: "  " }],
    ["given to", { givenTo: "" }],
  ])("asks for date, item and who it was given to when the %s is missing", async (_name, change) => {
    givenDatabase();
    expect(await saveGiveaway({ ...giveaway, ...change })).toEqual({
      error: "Fill in date, item and who it was given to.",
    });
    expect(writes).toEqual([]);
  });

  it.each(["0", "-2", "1.5", "abc"])("refuses the quantity %s", async (qty) => {
    givenDatabase();
    expect(await saveGiveaway({ ...giveaway, qty })).toEqual({
      error: "The quantity must be a whole number above 0.",
    });
  });

  it("refuses a negative unit cost", async () => {
    givenDatabase();
    expect((await saveGiveaway({ ...giveaway, unitCost: "-1" })).error).toBe(
      "The unit cost must be an amount in RM.",
    );
  });

  it("refuses HR & Accounts, who only look", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect(await saveGiveaway(giveaway)).toEqual({
      error: "You can look at this page but not change it.",
    });
    expect(writes).toEqual([]);
  });

  it("says so when the line to change is gone", async () => {
    givenDatabase({ data: [] });
    expect(await saveGiveaway({ ...giveaway, id: GIVEAWAY })).toEqual({
      error: "Could not find that give-away. Reload the page.",
    });
  });
});

describe("deleteGiveaway", () => {
  it("deletes a line", async () => {
    givenDatabase();
    expect(await deleteGiveaway(GIVEAWAY)).toEqual({ error: null });
    expect(writes).toEqual([{ op: "delete", row: undefined }]);
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect((await deleteGiveaway(GIVEAWAY)).error).toBe(
      "You can look at this page but not change it.",
    );
  });
});
