"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import { expenseId, expenseSchema } from "./marketing-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";
import { findOrAddVendor } from "./marketing-vendor-lookup";

export type MarketingResult = { error: string | null };

const NOT_FOUND = "Could not find that expense. Reload the page.";

/** Adds an expense, or saves changes to one. For RM the RM amount is the amount. */
export async function saveMarketingExpense(
  input: unknown,
): Promise<MarketingResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const vendor = await findOrAddVendor(supabase, form.vendor);
  if ("error" in vendor) {
    if (vendor.error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not find or add the vendor", vendor.error, {
      profileId: me.id,
    });
    return { error: TRY_AGAIN };
  }

  const fields = {
    spent_on: form.spentOn,
    category_id: form.categoryId,
    description: form.description,
    vendor_id: vendor.id,
    invoice_ref: form.invoiceRef,
    currency: form.currency,
    amount: form.amount,
    amount_rm: form.amountRm,
    event_id: form.eventId,
    payment_method: form.paymentMethod,
    remarks: form.remarks,
  };
  const { data, error } = form.id
    ? await supabase
        .from("marketing_expenses")
        .update(fields)
        .eq("id", form.id)
        .select("id")
    : await supabase.from("marketing_expenses").insert(fields).select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") {
      return { error: "That category or event is gone. Reload the page." };
    }
    logServerError("Could not save the marketing expense", error, {
      profileId: me.id,
      recordId: form.id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

export async function deleteMarketingExpense(
  id: string,
): Promise<MarketingResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = expenseId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_expenses")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    logServerError("Could not delete the marketing expense", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}
