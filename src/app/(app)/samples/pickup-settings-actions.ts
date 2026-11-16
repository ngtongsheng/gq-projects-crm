"use server";

import { revalidatePath } from "next/cache";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import {
  nextPickupNumberSchema,
  pickupSettingsSchema,
} from "./pickup-settings-schema";
import {
  NOT_EDITOR,
  plainDbMessage,
  type SampleResult,
  TRY_AGAIN,
} from "./sample-errors";

/** Best Link's WhatsApp number and the Drive folder the forms are kept in. */
export async function savePickupSettings(
  formData: FormData,
): Promise<SampleResult> {
  const me = await requirePage("stock");
  if (!canEditSamples(me)) return { error: NOT_EDITOR };

  const parsed = pickupSettingsSchema.safeParse({
    bestLinkWhatsapp: textField(formData, "bestLinkWhatsapp"),
    driveFolderUrl: textField(formData, "driveFolderUrl"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_pickup_settings")
    .update({
      best_link_whatsapp: parsed.data.bestLinkWhatsapp,
      drive_folder_url: parsed.data.driveFolderUrl,
    })
    .eq("id", true)
    .select("id");
  if (error) {
    console.error("Could not save the pickup settings", error);
    return { error: error.code === "42501" ? NOT_EDITOR : TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_EDITOR };

  revalidatePath("/samples");
  return { error: null };
}

/**
 * Sets the next pickup form number once, to continue from the last paper form. The database
 * refuses a number that is not above every number used or cancelled.
 */
export async function setNextPickupNumber(
  formData: FormData,
): Promise<SampleResult> {
  const me = await requirePage("stock");
  if (!canEditSamples(me)) return { error: NOT_EDITOR };

  const parsed = nextPickupNumberSchema.safeParse({
    nextNo: textField(formData, "nextNo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_next_sample_pickup_number", {
    p_next_no: parsed.data.nextNo,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    const plain = plainDbMessage(error);
    if (plain) return { error: plain };
    console.error("Could not set the next form no.", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/samples");
  return { error: null };
}
