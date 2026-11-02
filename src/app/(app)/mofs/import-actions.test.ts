import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { importMofs, previewMofImport } from "./import-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const ME = "11111111-1111-4111-8111-111111111111";
const ARUN = "22222222-2222-4222-8222-222222222222";
const SAVED = "33333333-3333-4333-8333-333333333333";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

function fakeSupabase() {
  const imports: { name: string; rows: unknown }[] = [];
  const client = {
    rpc: vi.fn(async (name: string, args?: { import_rows: unknown }) => {
      if (name === "team_directory") {
        return {
          data: [
            { id: ME, full_name: "Mei" },
            { id: ARUN, full_name: "Arun" },
          ],
          error: null,
        };
      }
      imports.push({ name, rows: args?.import_rows });
      return { data: null, error: null };
    }),
    // Only reading is faked: a direct write to mofs would throw, so a pass proves none happens.
    from: vi.fn((table: string) => ({
      select: () =>
        Promise.resolve({
          data:
            table === "mofs"
              ? [{ id: SAVED, mof_no: "MOF-100", vo_amount: 500 }]
              : [],
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

const head = ["MOF no", "LOA date", "Salesperson", "Company", "Project"];
const request = (text: string, onDuplicate: "skip" | "update" = "skip") => ({
  kind: "mofs",
  text,
  onDuplicate,
});

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
});

describe("importMofs", () => {
  it("refuses roles that cannot keep the register", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const imports = fakeSupabase();
    const result = await importMofs(
      request(
        tsv(
          [...head, "Contract sum", "Product"],
          ["MOF-200", "5/11/2026", "Mei", "Acme", "Lobby", "1000", "Tile"],
        ),
      ),
    );
    expect(result.error).toMatch(/MD, Purchasing or HR & Accounts/);
    expect(imports).toEqual([]);
  });

  it("makes one MOF of the rows that share a MOF no, with a line each", async () => {
    const imports = fakeSupabase();
    const result = await importMofs(
      request(
        tsv(
          [
            ...head,
            "Contract sum",
            "Product",
            "Stock type",
            "Supplier",
            "Qty",
            "Unit",
            "Area m2",
          ],
          [
            "mof-200",
            "5/11/2026",
            "Mei",
            "Acme",
            "Lobby",
            "RM 12,000.50",
            "Carpet tile",
            "",
            "",
            "100",
            "m2",
            "",
          ],
          [
            "MOF-200",
            "",
            "",
            "",
            "",
            "",
            "Vinyl",
            "Indent",
            "Unijoy",
            "2",
            "roll",
            "30",
          ],
        ),
      ),
    );
    expect(result).toEqual({
      error: null,
      counts: { add: 1, update: 0, skip: 0, invalid: 0 },
    });
    expect(imports).toHaveLength(1);
    expect(imports[0]?.name).toBe("import_mofs");
    expect(imports[0]?.rows).toEqual([
      expect.objectContaining({
        mof_no: "MOF-200",
        loa_date: "2026-11-05",
        salesperson_id: ME,
        company_name: "Acme",
        project_name: "Lobby",
        contract_sum: 12000.5,
        vo_amount: 0,
        scope: "s_and_l",
        stage: "pending_order",
        lines: [
          {
            product: "Carpet tile",
            stock_type: "stock",
            supplier: null,
            qty: 100,
            unit: "m2",
            area_m2: 100,
          },
          {
            product: "Vinyl",
            stock_type: "indent",
            supplier: "Unijoy",
            qty: 2,
            unit: "roll",
            area_m2: 30,
          },
        ],
      }),
    ]);
  });

  it("flags rows of one MOF that disagree, and a new MOF with no product", async () => {
    const imports = fakeSupabase();
    const result = await previewMofImport(
      request(
        tsv(
          [...head, "Contract sum", "Product"],
          ["MOF-300", "5/11/2026", "Mei", "Acme", "Lobby", "1000", "Tile"],
          ["MOF-300", "5/11/2026", "Mei", "Acme", "Lobby", "2000", "Vinyl"],
          ["MOF-301", "5/11/2026", "Mei", "Acme", "Gym", "1000", ""],
        ),
      ),
    );
    expect(result.preview?.rows.map((row) => row.errors)).toEqual([
      ['"Contract sum" differs between rows of the same MOF.'],
      ["Add at least one product line."],
    ]);
    expect(imports).toEqual([]);
  });

  it("updates a saved MOF with only the pasted columns, lines and VO untouched", async () => {
    const imports = fakeSupabase();
    const result = await importMofs(
      request(
        tsv(
          [...head, "Contract sum", "Stage"],
          ["mof-100", "5/11/2026", "Arun", "Acme", "Lobby", "9000", "Ordered"],
        ),
        "update",
      ),
    );
    expect(result.counts).toEqual({ add: 0, update: 1, skip: 0, invalid: 0 });
    // The total change is made by import_mofs through update_mof_total.
    expect(imports[0]).toEqual({
      name: "import_mofs",
      rows: [
        {
          id: SAVED,
          mof_no: "MOF-100",
          loa_date: "2026-11-05",
          salesperson_id: ARUN,
          company_name: "Acme",
          project_name: "Lobby",
          contract_sum: 9000,
          stage: "ordered",
        },
      ],
    });
  });

  it("checks a changed contract sum against the VO already saved", async () => {
    fakeSupabase();
    const result = await previewMofImport(
      request(
        tsv(
          [...head, "Contract sum"],
          ["MOF-100", "5/11/2026", "Arun", "Acme", "Lobby", "-1000"],
        ),
        "update",
      ),
    );
    expect(result.preview?.rows[0]?.action).toBe("invalid");
  });

  it("takes the cost column from managers only", async () => {
    const columns = [...head, "Contract sum", "Product", "Cost"];
    const row = [
      "MOF-400",
      "5/11/2026",
      "Mei",
      "Acme",
      "Lobby",
      "1000",
      "Tile",
      "640",
    ];

    const asManager = fakeSupabase();
    await importMofs(request(tsv(columns, row)));
    expect(asManager[0]?.rows).toEqual([
      expect.objectContaining({ cost: 640 }),
    ]);

    vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
    const asPurchasing = fakeSupabase();
    const preview = await previewMofImport(request(tsv(columns, row)));
    expect(preview.preview?.ignored).toEqual(["Cost"]);
    await importMofs(request(tsv(columns, row)));
    expect(JSON.stringify(asPurchasing[0]?.rows)).not.toContain("cost");
  });
});

describe("import_mofs", () => {
  it("changes an existing MOF's total only through update_mof_total, with the reason Imported", () => {
    const sql = readFileSync(
      "supabase/migrations/20261103190000_mof_stock_leftover_import.sql",
      "utf8",
    );
    expect(sql).toContain(
      "perform public.update_mof_total(mid, new_sum, new_vo, 'Imported')",
    );
    expect(sql).not.toMatch(/\bcontract_sum = /);
    expect(sql).toMatch(/security invoker/);
  });
});
