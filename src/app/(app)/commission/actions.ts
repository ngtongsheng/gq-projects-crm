"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canPayOutCommission } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { formatRm, parseRm, toCents } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionLines } from "./commission-data";

export type PayoutResult = { error: string | null };

const NOT_ALLOWED = "Only the MD and HR & Accounts can record commission paid.";
const NOT_FOUND_ORDER = "Could not find that order. Reload the page.";
const NOT_FOUND_PAYOUT =
  "Could not find that payout. It may already be removed. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";
const OVER_PAYABLE = "That is more than the";
const NOTHING_PAYABLE = "Nothing can be paid out on this order yet.";
// numeric(14,2) holds 12 digits before the decimal point.
const MAX_AMOUNT = 999_999_999_999.99;

const payoutForm = z.object({
  mofId: z.uuid({ error: NOT_FOUND_ORDER }),
  profileId: z.uuid({ error: "Choose who was paid." }),
  amount: z
    .string()
    .transform((text) => parseRm(text))
    .pipe(
      z
        .number({ error: "Enter the amount paid, e.g. 1,500.00." })
        .positive("Enter an amount above zero.")
        .max(MAX_AMOUNT, "That amount is too large."),
    ),
  paidOn: z.iso.date("Choose the date it was paid."),
  note: z
    .string()
    .trim()
    .max(300, "Keep the note under 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});

/**
 * Records commission paid to a person on an order. It can't exceed what is left to pay out, and
 * nothing is payable until the order has reached the claim threshold. Checked here for a quick
 * answer; the database checks it again (cap_commission_payouts) in case two payouts land at once.
 */
export async function recordPayout(formData: FormData): Promise<PayoutResult> {
  const me = await requireSection("commission");
  if (!canPayOutCommission(me.jobRole)) return { error: NOT_ALLOWED };

  const parsed = payoutForm.safeParse({
    mofId: textField(formData, "mofId"),
    profileId: textField(formData, "profileId"),
    amount: textField(formData, "amount"),
    paidOn: textField(formData, "paidOn"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const payout = parsed.data;
  if (payout.paidOn > todayMyt())
    return { error: "That date is in the future." };

  const line = (await loadCommissionLines(payout.mofId)).find(
    (candidate) => candidate.personId === payout.profileId,
  );
  if (!line) return { error: "That person has no commission on this order." };
  if (toCents(payout.amount) > toCents(line.balance.payableNow)) {
    return {
      error:
        line.balance.payableNow > 0
          ? `${OVER_PAYABLE} ${formatRm(line.balance.payableNow)} left to pay out.`
          : NOTHING_PAYABLE,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("commission_payouts").insert({
    profile_id: payout.profileId,
    mof_id: payout.mofId,
    amount: payout.amount,
    paid_on: payout.paidOn,
    note: payout.note,
  });
  if (error) {
    if (
      error.code === "23514" &&
      (error.message.startsWith(OVER_PAYABLE) ||
        error.message === NOTHING_PAYABLE)
    ) {
      return { error: error.message };
    }
    if (error.code === "42501") return { error: NOT_ALLOWED };
    if (error.code === "23503") return { error: NOT_FOUND_ORDER };
    console.error("Could not record the commission payout", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/commission");
  return { error: null };
}

/** Removes a payout entered by mistake. Payouts are never edited, so re-enter it correctly. */
export async function removePayout(payoutId: string): Promise<PayoutResult> {
  const me = await requireSection("commission");
  if (!canPayOutCommission(me.jobRole)) return { error: NOT_ALLOWED };

  const id = z.uuid().safeParse(payoutId);
  if (!id.success) return { error: NOT_FOUND_PAYOUT };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_payouts")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("Could not remove the commission payout", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_PAYOUT };

  revalidatePath("/commission");
  return { error: null };
}
