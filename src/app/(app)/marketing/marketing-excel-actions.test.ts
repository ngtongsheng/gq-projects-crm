import { Workbook } from "exceljs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile, type Profile } from "@/lib/auth/current-profile";
import { createClient } from "@/lib/supabase/server";
import { importMarketingExcel } from "./marketing-excel-actions";

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
vi.mock("./marketing-data", () => ({
  loadMarketingCategories: async () => [],
  loadEventOptions: async () => [],
}));

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

async function upload(rows: (string | number | null)[][]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Log");
  for (const row of rows) sheet.addRow(row);
  const form = new FormData();
  form.set(
    "file",
    new File([await workbook.xlsx.writeBuffer()], "marketing.xlsx"),
  );
  form.set("replace", "true");
  return form;
}

const HEAD = [
  "Date",
  "Category",
  "Campaign / event",
  "Description",
  "Vendor",
  "Currency",
  "Amount",
];

beforeEach(() => {
  vi.mocked(createClient).mockClear();
  vi.mocked(getCurrentProfile).mockResolvedValue(profile("marketing"));
});

describe("importMarketingExcel", () => {
  it("refuses HR & Accounts, who only look at this page", async () => {
    vi.mocked(getCurrentProfile).mockResolvedValue(profile("accounts"));

    const result = await importMarketingExcel(await upload([HEAD]));

    expect(result.error).toBe("You can look at this page but not change it.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("imports nothing when a row is wrong and says which", async () => {
    const result = await importMarketingExcel(
      await upload([
        HEAD,
        ["2026-01-05", "Folder", null, "Item", null, "RM", 10],
      ]),
    );

    expect(result.error).toBe(
      "Nothing was imported. Fix these rows and try again.",
    );
    expect(result.problems).toEqual([
      {
        sheet: "Log",
        row: 2,
        message: "Fill in date, description, vendor and amount.",
      },
    ]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("says so when the file is not an Excel workbook", async () => {
    const form = new FormData();
    form.set("file", new File(["not a workbook"], "marketing.xlsx"));

    const result = await importMarketingExcel(form);

    expect(result.error).toBe(
      "Could not read that file. Save it as an Excel .xlsx file.",
    );
  });

  it("says so when the workbook has no sheet it knows", async () => {
    const result = await importMarketingExcel(await upload([["Hello"]]));

    expect(result.error).toBe(
      "No expense, event, prepaid or give-away sheet found in that file.",
    );
  });
});
