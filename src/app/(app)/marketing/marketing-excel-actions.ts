"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import { loadEventOptions, loadMarketingCategories } from "./marketing-data";
import { parseMarketingWorkbook } from "./marketing-excel-import";
import { MAX_IMPORT_BYTES } from "./marketing-excel-layout";
import type { ImportProblem } from "./marketing-excel-plan";
import { applyMarketingImport } from "./marketing-excel-store";
import { NOT_EDITOR } from "./marketing-refusal";

const MAX_PROBLEMS_SHOWN = 10;

export type ImportCounts = {
  expenses: number;
  events: number;
  costs: number;
  prepaid: number;
  giveaways: number;
};

export type ImportResult = {
  error: string | null;
  /** The first rows that could not be read, when nothing was imported for that reason. */
  problems: ImportProblem[];
  /** How many problems there were in all. */
  problemCount: number;
  counts: ImportCounts | null;
};

const refused = (
  error: string,
  problems: ImportProblem[] = [],
): ImportResult => ({
  error,
  problems: problems.slice(0, MAX_PROBLEMS_SHOWN),
  problemCount: problems.length,
  counts: null,
});

/**
 * Imports a marketing Excel file (demo sheetMkImp). The whole file is checked first: one bad row
 * stops the import and nothing is saved. With `replace` the expenses, event cost sheets, prepaid
 * lines and give-aways the file brings are swapped for what is in the app; otherwise they are added.
 */
export async function importMarketingExcel(
  formData: FormData,
): Promise<ImportResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return refused(NOT_EDITOR);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return refused("Choose the Excel file to import.");
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return refused("That file is too big. Keep it under 1 MB.");
  }

  const [categories, events] = await Promise.all([
    loadMarketingCategories(),
    loadEventOptions(),
  ]);
  const plan = await parseMarketingWorkbook(await file.arrayBuffer(), {
    categories,
    events,
  }).catch((error: unknown) => {
    logServerError("Could not read the marketing Excel file", error, {
      profileId: me.id,
    });
    return null;
  });
  if (plan === null) {
    return refused("Could not read that file. Save it as an Excel .xlsx file.");
  }
  if (plan.errors.length > 0) {
    return refused(
      "Nothing was imported. Fix these rows and try again.",
      plan.errors,
    );
  }
  const counts: ImportCounts = {
    expenses: plan.expenses.length,
    events: plan.events.length,
    costs: plan.costs.length,
    prepaid: plan.prepaid.length,
    giveaways: plan.giveaways.length,
  };
  const found = Object.values(plan.found).some(Boolean);
  if (!found) {
    return refused(
      "No expense, event, prepaid or give-away sheet found in that file.",
    );
  }

  const supabase = await createClient();
  const { error } = await applyMarketingImport(
    supabase,
    plan,
    formData.get("replace") === "true",
  );
  if (error) {
    if (error.code === "42501") return refused(NOT_EDITOR);
    logServerError("Could not import the marketing Excel file", error, {
      profileId: me.id,
    });
    return refused("Could not import the file. Try again.");
  }

  revalidatePath("/marketing");
  return { error: null, problems: [], problemCount: 0, counts };
}
