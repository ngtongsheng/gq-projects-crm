import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { saveMarketingCategories } from "./marketing-category-actions";

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

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const profile = (jobRole: Profile["jobRole"]): Profile => ({
  id: "11111111-1111-4111-8111-111111111111",
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

const calls: string[] = [];
let upserted: unknown;

/** A database holding categories A and B; `deleteError` is what removing a category answers. */
function givenDatabase(deleteError: { code: string } | null = null) {
  const client = {
    from: () => ({
      select: async () => ({ data: [{ id: A }, { id: B }], error: null }),
      delete: () => ({
        in: async (_column: string, ids: string[]) => {
          calls.push(`delete ${ids.join()}`);
          return { error: deleteError };
        },
      }),
      upsert: async (rows: unknown) => {
        calls.push("upsert");
        upserted = rows;
        return { error: null };
      },
    }),
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  upserted = undefined;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("support"));
});

describe("saveMarketingCategories", () => {
  it("numbers the list in the order it comes and deletes what is missing before saving", async () => {
    givenDatabase();
    expect(
      await saveMarketingCategories([
        { id: C, name: " New category " },
        { id: A, name: "Folder" },
      ]),
    ).toEqual({ error: null });
    expect(calls).toEqual([`delete ${B}`, "upsert"]);
    expect(upserted).toEqual([
      { id: C, name: "New category", sort_order: 1 },
      { id: A, name: "Folder", sort_order: 2 },
    ]);
  });

  it("saves nothing when a delete is refused because expenses use the category", async () => {
    givenDatabase({ code: "23503" });
    expect(
      (await saveMarketingCategories([{ id: A, name: "Folder" }])).error,
    ).toMatch(/still use/);
    expect(calls).toEqual([`delete ${B}`]);
  });

  it("refuses an empty name and names that differ only in capitals", async () => {
    givenDatabase();
    expect((await saveMarketingCategories([{ id: A, name: "  " }])).error).toBe(
      "Give every category a name.",
    );
    expect(
      (
        await saveMarketingCategories([
          { id: A, name: "Folder" },
          { id: B, name: "FOLDER" },
        ])
      ).error,
    ).toBe("Two categories have the same name.");
    expect(calls).toEqual([]);
  });

  it("refuses HR & Accounts", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));
    givenDatabase();
    expect(
      (await saveMarketingCategories([{ id: A, name: "Folder" }])).error,
    ).toBe("You can look at this page but not change it.");
    expect(calls).toEqual([]);
  });
});
