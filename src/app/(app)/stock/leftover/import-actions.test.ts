import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { importLeftovers, previewLeftoverImport } from "./import-actions";

vi.mock("@/lib/auth/current-profile", () => ({ getCurrentProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const MOF = "33333333-3333-4333-8333-333333333333";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Sarah",
  role: "staff",
  jobRole,
  arrangesStock: false,
  commissionMode: "standard",
  yearlyTarget: null,
});

function fakeSupabase() {
  const imports: { name: string; rows: unknown }[] = [];
  const tables: Record<string, unknown[]> = {
    mofs: [{ id: MOF, mof_no: "MOF-100" }],
    leftovers: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        mof_id: MOF,
        item: "Carpet tile",
        qty: 3,
        unit: "box",
        condition: "good",
        destination: "supplier",
      },
    ],
  };
  const client = {
    rpc: vi.fn(async (name: string, args: { import_rows: unknown }) => {
      imports.push({ name, rows: args.import_rows });
      return { data: null, error: null };
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
const request = (text: string) => ({
  kind: "leftover",
  text,
  onDuplicate: "update" as const,
});
const head = ["MOF no", "Item", "Qty", "Unit", "Condition", "Destination"];

beforeEach(() => {
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("importLeftovers", () => {
  it("refuses roles that cannot record leftover stock", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("sales"));
    const imports = fakeSupabase();
    const result = await importLeftovers(
      request(tsv(head, ["MOF-100", "Glue", "2", "pail", "", ""])),
    );
    expect(result.error).toMatch(/site supervisor/);
    expect(imports).toEqual([]);
  });

  it("maps the columns, fills the usual defaults and only adds", async () => {
    const imports = fakeSupabase();
    const result = await importLeftovers(
      request(
        tsv(
          [...head, "Note"],
          ["mof-100", "Roll vinyl", "2", "roll", "offcut", "", "By lift"],
          ["MOF-100", "Glue", "2", "pail", "", "Supplier", ""],
          ["MOF-999", "Glue", "2", "pail", "", "", ""],
          ["MOF-100", "carpet tile", "3", "box", "good", "supplier", ""],
          ["MOF-100", "Tile", "1", "crate", "", "", ""],
        ),
      ),
    );
    expect(result).toEqual({
      error: null,
      counts: { add: 2, update: 0, skip: 1, invalid: 2 },
    });
    expect(imports).toEqual([
      {
        name: "import_leftovers",
        rows: [
          {
            mof_id: MOF,
            item: "Roll vinyl",
            qty: 2,
            unit: "roll",
            condition: "offcut",
            destination: "gq",
            note: "By lift",
          },
          {
            mof_id: MOF,
            item: "Glue",
            qty: 2,
            unit: "pail",
            condition: "good",
            destination: "supplier",
            note: null,
          },
        ],
      },
    ]);
  });

  it("previews rows without saving", async () => {
    const imports = fakeSupabase();
    const result = await previewLeftoverImport(
      request(tsv(head, ["MOF-999", "Glue", "2", "pail", "", ""])),
    );
    expect(result.preview?.rows[0]?.errors).toEqual([
      'No MOF numbered "MOF-999".',
    ]);
    expect(imports).toEqual([]);
  });
});
