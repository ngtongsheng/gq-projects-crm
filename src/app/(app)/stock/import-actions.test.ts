import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { importStockItems, previewStockImport } from "./import-actions";

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

const SAVED = "33333333-3333-4333-8333-333333333333";

const profile = (
  jobRole: Profile["jobRole"],
  arrangesStock = false,
): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Sarah",
  role: "staff",
  jobRole,
  arrangesStock,
  sells: false,
  seesMargin: false,
  commissionMode: "standard",
  yearlyTarget: null,
  language: "en",
});

function fakeSupabase() {
  const imports: { name: string; rows: unknown }[] = [];
  const client = {
    rpc: vi.fn(async (name: string, args: { import_rows: unknown }) => {
      imports.push({ name, rows: args.import_rows });
      return { data: null, error: null };
    }),
    from: vi.fn(() => ({
      select: () =>
        Promise.resolve({
          data: [{ id: SAVED, sku: "7950-2", unit: "box" }],
          error: null,
        }),
    })),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return imports;
}

const tsv = (...lines: string[][]) =>
  lines.map((line) => line.join("\t")).join("\r\n");
const request = (text: string, onDuplicate: "skip" | "update" = "skip") => ({
  kind: "stock",
  text,
  onDuplicate,
});

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("importStockItems", () => {
  it("refuses people who do not arrange stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const imports = fakeSupabase();
    const result = await importStockItems(
      request(
        tsv(["SKU", "Supplier", "Qty", "Unit"], ["A1", "Unijoy", "5", "box"]),
      ),
    );
    expect(result.error).toMatch(/arrange stock/);
    expect(imports).toEqual([]);
  });

  it("maps the columns, reads units by label and saves only valid rows", async () => {
    const imports = fakeSupabase();
    const result = await importStockItems(
      request(
        tsv(
          ["SKU", "Supplier", "Collection", "Qty", "Unit"],
          ["A1", "Unijoy", "Loop", "1,250.5", "m²"],
          ["A2", "Unijoy", "", "3", "crate"],
          ["A3", "Unijoy", "", "", "box"],
          ["a1", "Unijoy", "", "1", "m2"],
        ),
      ),
    );
    expect(result).toEqual({
      error: null,
      counts: { add: 1, update: 0, skip: 0, invalid: 3 },
    });
    expect(imports).toEqual([
      {
        name: "import_stock_items",
        rows: [
          {
            sku: "A1",
            supplier: "Unijoy",
            collection: "Loop",
            qty: 1250.5,
            unit: "m2",
          },
        ],
      },
    ]);
  });

  it("updates a saved SKU with only the pasted columns and never its unit", async () => {
    const imports = fakeSupabase();
    await importStockItems(
      request(
        tsv(
          ["SKU", "Supplier", "Qty", "Unit"],
          ["7950-2", "Unijoy", "40", "box"],
        ),
        "update",
      ),
    );
    expect(imports[0]?.rows).toEqual([
      { id: SAVED, supplier: "Unijoy", qty: 40 },
    ]);

    const clash = await previewStockImport(
      request(
        tsv(
          ["SKU", "Supplier", "Qty", "Unit"],
          ["7950-2", "Unijoy", "40", "roll"],
        ),
        "update",
      ),
    );
    expect(clash.preview?.rows[0]?.action).toBe("invalid");
    expect(clash.preview?.rows[0]?.errors[0]).toMatch(/unit can't change/);
  });
});
