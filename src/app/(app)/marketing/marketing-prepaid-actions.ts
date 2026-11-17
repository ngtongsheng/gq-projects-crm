"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import {
  prepaidAlertSchema,
  prepaidEntryId,
  prepaidEntrySchema,
} from "./marketing-prepaid-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";
import { findOrAddVendor } from "./marketing-vendor-lookup";

export type PrepaidResult = { error: string | null };

const ENTRY_NOT_FOUND = "Could not find that entry. Reload the page.";
const VENDOR_NOT_FOUND = "Could not find that vendor. Reload the page.";

const newBalance = z.object({ balance: z.number(), low: z.boolean() });

/**
 * Adds a top-up or a deducted job, or saves changes to one. The answer carries the vendor's
 * balance after the save, for the "balance now" message.
 */
export async function savePrepaidEntry(
  input: unknown,
): Promise<PrepaidResult & { balance?: number; low?: boolean }> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = prepaidEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { id, kind, vendor: vendorName, ...form } = parsed.data;

  const supabase = await createClient();
  const vendor = await findOrAddVendor(supabase, vendorName);
  if ("error" in vendor) {
    if (vendor.error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not find or add the vendor", vendor.error, {
      profileId: me.id,
    });
    return { error: TRY_AGAIN };
  }

  // The kind of an entry never changes, so it is only sent when adding.
  const fields = {
    entry_on: form.entryOn,
    vendor_id: vendor.id,
    description: form.description,
    foreign_currency: form.foreignCurrency,
    foreign_amount: form.foreignAmount,
    amount_rm: form.amountRm,
    mof_ref: form.mofRef,
    marketing_foc: form.marketingFoc,
    remarks: form.remarks,
  };
  const { data, error } = id
    ? await supabase
        .from("marketing_prepaid_entries")
        .update(fields)
        .eq("id", id)
        .select("id")
    : await supabase
        .from("marketing_prepaid_entries")
        .insert({ ...fields, kind })
        .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") return { error: VENDOR_NOT_FOUND };
    logServerError("Could not save the prepaid entry", error, {
      profileId: me.id,
      recordId: id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: ENTRY_NOT_FOUND };

  revalidatePath("/marketing");

  const balance = await supabase
    .from("marketing_prepaid_balances")
    .select("balance, low")
    .eq("vendor_id", vendor.id)
    .maybeSingle();
  if (balance.error || !balance.data) {
    if (balance.error) {
      logServerError("Could not read the prepaid balance", balance.error, {
        profileId: me.id,
        recordId: vendor.id,
      });
    }
    return { error: null };
  }
  return { error: null, ...newBalance.parse(balance.data) };
}

/** Deletes a top-up or a job. */
export async function deletePrepaidEntry(id: string): Promise<PrepaidResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = prepaidEntryId.safeParse(id);
  if (!parsed.success) return { error: ENTRY_NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_prepaid_entries")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not delete the prepaid entry", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: ENTRY_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

/** Sets the balance below which a vendor's account turns red; 0 turns the alert off. */
export async function savePrepaidAlert(input: unknown): Promise<PrepaidResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = prepaidAlertSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_vendors")
    .update({ low_balance_alert: parsed.data.alert })
    .eq("id", parsed.data.vendorId)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not save the low-balance alert", error, {
      profileId: me.id,
      recordId: parsed.data.vendorId,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: VENDOR_NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}
