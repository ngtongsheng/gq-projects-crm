"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import {
  NOT_EDITOR,
  plainDbMessage,
  type SampleResult,
  TRY_AGAIN,
} from "./sample-errors";
import { pickupFormSchema } from "./sample-schemas";

export type SavePickupResult =
  | { error: string; pickupId: null }
  | { error: null; pickupId: string };

const savedForm = z.array(z.object({ pickup_id: z.uuid() }));

/**
 * Numbers a Best Link pickup form, saves it and takes every row that names a sample out of
 * Best Link, all or nothing (save_sample_pickup).
 */
export async function savePickupForm(
  input: unknown,
): Promise<SavePickupResult> {
  const me = await requirePage("stock");
  if (!canEditSamples(me)) return { error: NOT_EDITOR, pickupId: null };

  const parsed = pickupFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the form.",
      pickupId: null,
    };
  }
  const { lines, ...form } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_sample_pickup", {
    p_pickup: {
      person_in_charge: form.personInCharge,
      contact: form.contact,
      method: form.method,
      appointment_on: form.appointmentOn,
      driver_contact: form.driverContact,
      vehicle_no: form.vehicleNo,
      address: form.address,
      taken_by: form.takenBy,
      for_whom: form.forWhom,
    },
    p_lines: lines.map((line) => ({
      sample_id: line.sampleId,
      product_name: line.productName,
      spec: line.spec,
      qty: line.qty,
      unit: line.unit,
      remarks: line.remarks,
    })),
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR, pickupId: null };
    // "Only 1 pc at Best Link." and "Row 2: this sample is counted in box."
    const plain = plainDbMessage(error);
    if (plain) return { error: plain, pickupId: null };
    console.error("Could not save the pickup form", error);
    return { error: TRY_AGAIN, pickupId: null };
  }

  const saved = savedForm.parse(data)[0];
  revalidatePath("/samples");
  return { error: null, pickupId: saved.pickup_id };
}

/** Notes that the form's PDF was saved (the demo's "PDF 14 Nov" under the form). */
export async function markPickupPdfSaved(
  pickupId: string,
): Promise<SampleResult> {
  const me = await requirePage("stock");
  if (!canEditSamples(me)) return { error: NOT_EDITOR };
  if (!z.uuid().safeParse(pickupId).success) {
    return { error: "Could not find that form. Reload the page." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_pickups")
    .update({ pdf_saved_at: new Date().toISOString() })
    .eq("id", pickupId)
    .select("id");
  if (error) {
    console.error("Could not note the saved PDF", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) {
    return { error: "Could not find that form. Reload the page." };
  }

  revalidatePath("/samples");
  revalidatePath(`/samples/pickup/${pickupId}`);
  return { error: null };
}
