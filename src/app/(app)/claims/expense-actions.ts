"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { describeMeals, ExpenseInput, MEALS } from "@/lib/domain/claim-expense";
import { claimMonthOf } from "@/lib/domain/monthly-claim";
import { textField } from "@/lib/form/form-fields";
import { formatMonth, todayMyt } from "@/lib/format/date";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { loadClaimSettings } from "./claim-settings-data";
import {
  CLAIM_LOCKED,
  isNotAllowed,
  openOwnClaim,
  TRY_AGAIN,
} from "./own-claim";

export type ExpenseResult = { error: string | null };
export type AddExpenseResult =
  | { error: string }
  | { error: null; claimId: string; expenseId: string; monthLabel: string };

const NOT_FILER = "Your role does not file a monthly claim.";
const NOT_FOUND = "Could not find that expense. Reload the page.";
const FUTURE = "You cannot claim for a day that has not come.";

/** A number field; blank or not a number reads as null, which the schema then asks for. */
function numberField(formData: FormData, key: string): number | null {
  const text = textField(formData, key).trim();
  const value = text === "" ? Number.NaN : Number(text);
  return Number.isFinite(value) ? value : null;
}

function readExpense(formData: FormData) {
  return ExpenseInput.safeParse({
    spentOn: textField(formData, "spentOn"),
    expenseType: textField(formData, "expenseType"),
    description: textField(formData, "description"),
    amount: numberField(formData, "amount"),
    km: numberField(formData, "km"),
    nights: numberField(formData, "nights"),
  });
}

const firstIssue = (error: z.ZodError) =>
  error.issues[0]?.message ?? "Check the details.";

/**
 * Adds an expense to the claim its date belongs to (dates after the cut-off day roll into next
 * month), starting that claim if needed. The receipt photo is uploaded afterwards against the
 * returned ids.
 */
export async function addExpense(
  formData: FormData,
): Promise<AddExpenseResult> {
  const me = await requirePage("claims");
  if (!canFileClaim(me)) return { error: NOT_FILER };

  const parsed = readExpense(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const expense = parsed.data;
  if (expense.spentOn > todayMyt()) return { error: FUTURE };

  const meals = z.array(z.enum(MEALS)).parse(formData.getAll("meals"));
  if (expense.expenseType === "outstation_meals" && meals.length === 0) {
    return { error: "Tick the meals." };
  }

  const settings = await loadClaimSettings();
  const month = claimMonthOf(expense.spentOn, settings.cutOffDay);
  const supabase = await createClient();
  const opened = await openOwnClaim(supabase, me, month);
  if (opened.error !== null) return { error: opened.error };

  const { data, error } = await supabase
    .from("monthly_claim_expenses")
    .insert({
      claim_id: opened.claimId,
      spent_on: expense.spentOn,
      expense_type: expense.expenseType,
      description:
        expense.expenseType === "outstation_meals"
          ? describeMeals(expense.description, meals)
          : expense.description,
      km: expense.km,
      nights: expense.nights,
      amount: expense.amount,
    })
    .select("id")
    .single();
  if (error || !data) {
    if (error && isNotAllowed(error)) return { error: CLAIM_LOCKED };
    logServerError("Could not add the claim expense", error, {
      profileId: me.id,
      recordId: opened.claimId,
    });
    return { error: TRY_AGAIN };
  }

  revalidatePath("/claims");
  return {
    error: null,
    claimId: opened.claimId,
    expenseId: z.uuid().parse(data.id),
    monthLabel: formatMonth(month),
  };
}

const expenseRow = z.object({
  monthly_claims: z.object({ month: z.iso.date() }),
});

/** Changes one expense on the person's open claim; its date must stay in the same claim month. */
export async function updateExpense(
  expenseId: string,
  formData: FormData,
): Promise<ExpenseResult> {
  const me = await requirePage("claims");
  const id = z.uuid().safeParse(expenseId);
  if (!id.success) return { error: NOT_FOUND };
  const parsed = readExpense(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const expense = parsed.data;
  if (expense.spentOn > todayMyt()) return { error: FUTURE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claim_expenses")
    .select("monthly_claims!inner(month)")
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    logServerError("Could not load the claim expense", error, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN };
  }
  if (!data) return { error: NOT_FOUND };
  const current = expenseRow.parse(data);

  const { cutOffDay } = await loadClaimSettings();
  const month = claimMonthOf(expense.spentOn, cutOffDay);
  if (month !== current.monthly_claims.month) {
    return {
      error: `That date belongs to the ${formatMonth(month)} claim. Delete this line and add it there.`,
    };
  }

  const { data: saved, error: saveError } = await supabase
    .from("monthly_claim_expenses")
    .update({
      spent_on: expense.spentOn,
      expense_type: expense.expenseType,
      description: expense.description,
      km: expense.km,
      nights: expense.nights,
      // Mileage is worked out by the database from the km; leave its amount out.
      ...(expense.amount === null ? {} : { amount: expense.amount }),
      // Mileage has no receipt; a photo kept from an earlier type would break that.
      ...(expense.expenseType === "mileage"
        ? {
            receipt_path: null,
            receipt_file_name: null,
            receipt_content_type: null,
          }
        : {}),
    })
    .eq("id", id.data)
    .select("id");
  if (saveError) {
    if (isNotAllowed(saveError)) return { error: CLAIM_LOCKED };
    logServerError("Could not change the claim expense", saveError, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN };
  }
  // Row-level security hides a line once the claim has left the person's hands.
  if (saved.length === 0) return { error: CLAIM_LOCKED };

  revalidatePath("/claims");
  return { error: null };
}

/** Removes one expense from the person's open claim. */
export async function deleteExpense(expenseId: string): Promise<ExpenseResult> {
  const me = await requirePage("claims");
  const id = z.uuid().safeParse(expenseId);
  if (!id.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claim_expenses")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    logServerError("Could not delete the claim expense", error, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: CLAIM_LOCKED };

  revalidatePath("/claims");
  return { error: null };
}
