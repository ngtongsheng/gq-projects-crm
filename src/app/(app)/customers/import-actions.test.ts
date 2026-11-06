import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { importCustomers, previewCustomerImport } from "./import-actions";

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
const ACME = "33333333-3333-4333-8333-333333333333";
const TAN = "44444444-4444-4444-8444-444444444444";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: ME,
  fullName: "Mei",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

function fakeSupabase(importError: { code?: string } | null = null) {
  const imports: { name: string; rows: unknown }[] = [];
  const tables: Record<string, unknown[]> = {
    companies: [{ id: ACME, name: "Acme Design" }],
    contacts: [{ id: TAN, mobile: "60123456789" }],
  };
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
      return { data: null, error: importError };
    }),
    from: vi.fn((table: string) => ({
      select: () => Promise.resolve({ data: tables[table], error: null }),
    })),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return imports;
}

const tsv = (...lines: string[][]) =>
  lines.map((line) => line.join("\t")).join("\r\n");

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("md"));
});

describe("importCustomers", () => {
  it("refuses roles other than the MD and Sales Director", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const imports = fakeSupabase();
    const result = await importCustomers({
      kind: "companies",
      text: tsv(["Company"], ["New Co"]),
      onDuplicate: "skip",
    });
    expect(result.error).toMatch(/MD or the Sales Director/);
    expect(imports).toEqual([]);
  });

  it("rejects an unknown import kind", async () => {
    const imports = fakeSupabase();
    const result = await importCustomers({
      kind: "profiles" as "companies",
      text: tsv(["Company"], ["New Co"]),
      onDuplicate: "skip",
    });
    expect(result.error).not.toBeNull();
    expect(imports).toEqual([]);
  });

  it("re-checks every row and saves only the valid ones", async () => {
    const imports = fakeSupabase();
    const result = await importCustomers({
      kind: "contacts",
      text: tsv(
        ["Company", "Name", "Mobile", "Owners"],
        ["Acme Design", "Lim", "012-999 8888", "Arun"],
        ["Acme Design", "Bad number", "123", ""],
        ["Nowhere Sdn Bhd", "Ghost", "013-111 2222", ""],
        ["Acme Design", "Owner forged", "014-111 2222", "Mallory"],
        ["Acme Design", "Tan again", "+60 12-345 6789", ""],
      ),
      onDuplicate: "skip",
    });
    expect(result).toEqual({
      error: null,
      counts: { add: 1, update: 0, skip: 1, invalid: 3 },
    });
    expect(imports).toEqual([
      {
        name: "import_contacts",
        rows: [
          {
            company_id: ACME,
            name: "Lim",
            mobile: "60129998888",
            title: null,
            notes: null,
            account_type: "own",
            passed_by: null,
            owners: [ARUN],
          },
        ],
      },
    ]);
  });

  it("updates an existing record with only the pasted columns", async () => {
    const imports = fakeSupabase();
    await importCustomers({
      kind: "companies",
      text: tsv(["Company name", "Type"], ["ACME DESIGN", "Main Contractor"]),
      onDuplicate: "update",
    });
    expect(imports[0]).toEqual({
      name: "import_companies",
      rows: [
        { id: ACME, name: "ACME DESIGN", company_type: "main_contractor" },
      ],
    });
  });

  it("adds a company with the usual defaults", async () => {
    const imports = fakeSupabase();
    await importCustomers({
      kind: "companies",
      text: tsv(
        ["Company", "Account type", "Passed by"],
        ["New Co", "Pass-down", "arun"],
      ),
      onDuplicate: "skip",
    });
    expect(imports[0]?.rows).toEqual([
      {
        name: "New Co",
        company_type: "others",
        rating: 3,
        address: null,
        notes: null,
        account_type: "pass_down",
        passed_by: ARUN,
      },
    ]);
  });

  it("saves nothing when no row is valid", async () => {
    const imports = fakeSupabase();
    const result = await importCustomers({
      kind: "companies",
      text: tsv(["Company", "Rating"], ["New Co", "9"]),
      onDuplicate: "skip",
    });
    expect(result.error).toMatch(/No rows to save/);
    expect(imports).toEqual([]);
  });

  it("explains a clash with a record added meanwhile", async () => {
    fakeSupabase({ code: "23505" });
    const result = await importCustomers({
      kind: "companies",
      text: tsv(["Company"], ["New Co"]),
      onDuplicate: "skip",
    });
    expect(result.error).toMatch(/Someone added one of these/);
  });
});

describe("previewCustomerImport", () => {
  it("shows each row's outcome without saving", async () => {
    const imports = fakeSupabase();
    const result = await previewCustomerImport({
      kind: "companies",
      text: tsv(
        ["Company", "Type", "Colour"],
        ["Acme design", ""],
        ["X", "Spaceship"],
      ),
      onDuplicate: "skip",
    });
    expect(result.preview).toEqual({
      headers: ["Company", "Type"],
      missing: [],
      ignored: ["Colour"],
      rows: [
        { line: 2, cells: ["Acme design", ""], action: "skip", errors: [] },
        {
          line: 3,
          cells: ["X", "Spaceship"],
          action: "invalid",
          errors: ['"Spaceship" is not a type.'],
        },
      ],
    });
    expect(imports).toEqual([]);
  });
});
