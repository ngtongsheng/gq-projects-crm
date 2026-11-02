"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEnterPayments } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { parseRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";

export type CollectionResult = { error: string | null };

const NOT_ALLOWED = "Only the MD and HR & Accounts can change payments.";
const NOT_FOUND_MOF = "Could not find that order. Reload the page.";
const NOT_FOUND_PAYMENT =
  "Could not find that payment. It may already be removed. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";
// numeric(14,2) holds 12 digits before the decimal point.
const MAX_AMOUNT = 999_999_999_999.99;

const paymentForm = z.object({
  mofId: z.uuid({ error: NOT_FOUND_MOF }),
  amount: z
    .string()
    .transform((text) => parseRm(text))
    .pipe(
      z
        .number({ error: "Enter the amount received, e.g. 1,500.00." })
        .positive("Enter an amount above zero.")
        .max(MAX_AMOUNT, "That amount is too large."),
    ),
  receivedOn: z.iso.date("Choose the date it was received."),
  note: z
    .string()
    .trim()
    .max(300, "Keep the note under 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});

/** Records money received on an order. The database also limits this to the MD and HR & Accounts. */
export async function recordPayment(
  formData: FormData,
): Promise<CollectionResult> {
  const me = await requireSection("collection");
  if (!canEnterPayments(me.jobRole)) return { error: NOT_ALLOWED };

  const parsed = paymentForm.safeParse({
    mofId: textField(formData, "mofId"),
    amount: textField(formData, "amount"),
    receivedOn: textField(formData, "receivedOn"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const payment = parsed.data;
  if (payment.receivedOn > todayMyt()) {
    return { error: "That date is in the future." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    mof_id: payment.mofId,
    amount: payment.amount,
    received_on: payment.receivedOn,
    note: payment.note,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    if (error.code === "23503") return { error: NOT_FOUND_MOF };
    console.error("Could not record the payment", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/collection");
  return { error: null };
}

/** Removes a payment entered by mistake. Payments are never edited, so re-enter it correctly. */
export async function removePayment(
  paymentId: string,
): Promise<CollectionResult> {
  const me = await requireSection("collection");
  if (!canEnterPayments(me.jobRole)) return { error: NOT_ALLOWED };

  const id = z.uuid().safeParse(paymentId);
  if (!id.success) return { error: NOT_FOUND_PAYMENT };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("Could not remove the payment", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_PAYMENT };

  revalidatePath("/collection");
  return { error: null };
}
