"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import {
  canRecordLeftover,
  LEFTOVER_RETURN_METHODS,
} from "@/lib/domain/leftover";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import type { LeftoverResult } from "./actions";

const NOT_COLLECTOR =
  "Only a site supervisor or the people who arrange stock can mark leftover stock collected.";
const NOT_WAITING =
  "This item is no longer waiting for pickup. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const collectForm = z.object({
  leftoverId: z.uuid({ error: "Could not find that item. Reload the page." }),
  returnMethod: z.enum(LEFTOVER_RETURN_METHODS, "Choose how it goes back."),
});

/**
 * The supervisor marks an item collected, says how it goes back and whether the office has the
 * WhatsApp. The database stamps who and when, and keeps a supervisor to these fields.
 */
export async function collectLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requirePage("site");
  if (!canRecordLeftover(me)) return { error: NOT_COLLECTOR };

  const parsed = collectForm.safeParse({
    leftoverId: textField(formData, "leftoverId"),
    returnMethod: textField(formData, "returnMethod"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const collected = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leftovers")
    .update({
      status: "collected_by_supervisor",
      return_method: collected.returnMethod,
      // Ticked once, it stays: unticking later must not erase that the office was told.
      ...(textField(formData, "whatsappSent") === "on"
        ? { whatsapp_sent_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", collected.leftoverId)
    .in("status", ["pending_pickup", "collected_by_supervisor"])
    .select("id, mof_id");
  if (error) {
    if (error.code === "42501") return { error: NOT_COLLECTOR };
    console.error("Could not mark the leftover stock collected", error);
    return { error: TRY_AGAIN };
  }
  const updated = data[0];
  if (!updated) return { error: NOT_WAITING };

  revalidatePath("/stock/leftover");
  revalidatePath(`/site-work/${updated.mof_id}`);
  return { error: null };
}
