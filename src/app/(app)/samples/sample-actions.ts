"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  NOT_EDITOR,
  NOT_FOUND_SAMPLE,
  plainDbMessage,
  type SampleResult,
  TRY_AGAIN,
} from "./sample-errors";
import { sampleSchema, takeOutSchema } from "./sample-schemas";

const idSchema = z.uuid({ error: NOT_FOUND_SAMPLE });
const currentQty = z.array(z.object({ qty: z.number() }));

async function requireEditor() {
  const me = await requirePage("stock");
  return canEditSamples(me) ? me : null;
}

/**
 * Adds a sample, or corrects one. A changed quantity is written to the sample's history as a
 * count (the database only lets the quantity move through that history).
 */
export async function saveSample(formData: FormData): Promise<SampleResult> {
  if (!(await requireEditor())) return { error: NOT_EDITOR };

  const rawId = textField(formData, "sampleId");
  const id = rawId === "" ? null : idSchema.safeParse(rawId);
  if (id && !id.success) return { error: NOT_FOUND_SAMPLE };

  const parsed = sampleSchema.safeParse({
    product: textField(formData, "product"),
    brand: textField(formData, "brand"),
    sku: textField(formData, "sku"),
    name: textField(formData, "name"),
    qty: textField(formData, "qty"),
    unit: textField(formData, "unit"),
    spec: textField(formData, "spec"),
    notes: textField(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { qty, ...fields } = parsed.data;

  const supabase = await createClient();
  if (!id) {
    const { error } = await supabase.from("samples").insert({ ...fields, qty });
    if (error) return { error: saveFailure(error, fields) };
    revalidatePath("/samples");
    return { error: null };
  }

  const { data: before, error: readError } = await supabase
    .from("samples")
    .select("qty")
    .eq("id", id.data);
  if (readError) {
    console.error("Could not read the sample", readError);
    return { error: TRY_AGAIN };
  }
  const was = currentQty.parse(before)[0];
  if (!was) return { error: NOT_FOUND_SAMPLE };

  const { error } = await supabase
    .from("samples")
    .update(fields)
    .eq("id", id.data)
    .select("id");
  if (error) return { error: saveFailure(error, fields) };

  if (was.qty !== qty) {
    const { error: countError } = await supabase
      .from("sample_moves")
      .insert({ sample_id: id.data, kind: "adjust", qty });
    if (countError) {
      console.error("Could not record the new quantity", countError);
      return {
        error: "The details were saved, but the quantity was not. Try again.",
      };
    }
  }

  revalidatePath("/samples");
  return { error: null };
}

function saveFailure(
  error: { code?: string; message?: string },
  fields: { sku: string | null; brand: string | null },
) {
  if (error.code === "42501") return NOT_EDITOR;
  if (error.code === "23505") {
    return `${fields.sku ?? "That SKU"} is already recorded${fields.brand ? ` for ${fields.brand}` : ""}. Open that line to change the quantity.`;
  }
  const plain = plainDbMessage(error);
  if (plain) return plain;
  console.error("Could not save the sample", error);
  return TRY_AGAIN;
}

/** Removes a sample and its history. Pickup forms that named it keep their printed rows. */
export async function deleteSample(sampleId: string): Promise<SampleResult> {
  if (!(await requireEditor())) return { error: NOT_EDITOR };
  const id = idSchema.safeParse(sampleId);
  if (!id.success) return { error: NOT_FOUND_SAMPLE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("samples")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) {
    console.error("Could not delete the sample", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND_SAMPLE };

  revalidatePath("/samples");
  return { error: null };
}

/** A sample leaves Best Link for a while, or for good when the client keeps it. */
export async function takeOutSample(input: unknown): Promise<SampleResult> {
  if (!(await requireEditor())) return { error: NOT_EDITOR };
  const parsed = takeOutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const move = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("sample_moves").insert({
    sample_id: move.sampleId,
    kind: move.clientKeeps ? "kept" : "out",
    qty: move.qty,
    moved_on: todayMyt(),
    taken_by: move.takenBy,
    for_whom: move.forWhom,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") return { error: NOT_FOUND_SAMPLE };
    const plain = plainDbMessage(error);
    if (plain) return { error: plain };
    console.error("Could not take the sample out", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/samples");
  return { error: null };
}

const returnForm = z.object({
  sampleId: idSchema,
  moveIds: z.array(z.uuid()).min(1, "Tick what came back."),
});

/** Samples taken out come back to Best Link; the quantity goes up again. */
export async function returnSamples(
  sampleId: string,
  moveIds: string[],
): Promise<SampleResult> {
  if (!(await requireEditor())) return { error: NOT_EDITOR };
  const parsed = returnForm.safeParse({ sampleId, moveIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_moves")
    .update({ back_on: todayMyt() })
    .eq("sample_id", parsed.data.sampleId)
    .in("id", parsed.data.moveIds)
    .is("back_on", null)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    const plain = plainDbMessage(error);
    if (plain) return { error: plain };
    console.error("Could not bring the sample back", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) {
    return { error: "Someone already marked these back. Reload the page." };
  }

  revalidatePath("/samples");
  return { error: null };
}
