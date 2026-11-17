"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createReadLink } from "@/lib/storage/signed-url";
import { createUploadTarget, type UploadTarget } from "@/lib/storage/upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  canBorrowCustomSample,
  isCustomSampleSeller,
  keepsCustomSamples,
} from "./custom-sample-access";
import { borrowSampleSchema, recordSampleSchema } from "./custom-sample-input";
import { plainRefusal } from "./custom-sample-refusal";

export type CustomSampleResult = { error: string | null };
export type BorrowResult = { error: string } | { error: null; dueOn: string };
export type UploadTargetResult =
  | { error: string }
  | { error: null; target: UploadTarget };
export type PhotoLinkResult = { error: string } | { error: null; url: string };

const NOT_KEEPER = "Only the office records custom samples.";
const NOT_BORROWER = "Only a salesperson borrows a custom sample.";
const NOT_FOUND = "Could not find that sample. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const sampleId = z.uuid({ error: NOT_FOUND });

/**
 * Step one of a photo upload: hand back a one-file upload token for custom-samples/<sample id>/.
 * The id is chosen by the browser before the sample exists, like an HR policy.
 */
export async function requestCustomSamplePhotoUpload(
  id: string,
  file: { fileName: string; contentType: string; size: number },
): Promise<UploadTargetResult> {
  const me = await requirePage("tuft");
  if (!keepsCustomSamples(me.jobRole)) return { error: NOT_KEEPER };
  const parsed = sampleId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const target = await createUploadTarget(await createClient(), {
    area: "custom-samples",
    recordId: parsed.data,
    ...file,
  });
  return target.ok
    ? { error: null, target: target.target }
    : { error: target.error };
}

/** Records a new sample, or saves changes to one. A blank code takes the next TS-### number. */
export async function saveCustomSample(
  input: unknown,
): Promise<CustomSampleResult> {
  const me = await requirePage("tuft");
  if (!keepsCustomSamples(me.jobRole)) return { error: NOT_KEEPER };
  const parsed = recordSampleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const fields = {
    received_on: form.receivedOn,
    design_name: form.designName,
    design_no: form.designNo,
    supplier: form.supplier,
    size: form.size,
    qty: form.qty,
    notes: form.notes,
  };
  const supabase = await createClient();
  const { data, error } = form.editing
    ? await supabase
        .from("custom_samples")
        .update({
          ...fields,
          ...(form.code ? { code: form.code } : {}),
          ...(form.photoPath ? { photo_path: form.photoPath } : {}),
        })
        .eq("id", form.id)
        .select("id")
    : await supabase
        .from("custom_samples")
        .insert({
          id: form.id,
          code: form.code,
          photo_path: form.photoPath,
          ...fields,
        })
        .select("id");
  if (error) {
    if (error.code === "23505") {
      return { error: `${form.code ?? "That code"} is already used.` };
    }
    const plain = plainRefusal(error);
    if (plain) return { error: plain };
    if (error.code === "42501") return { error: NOT_KEEPER };
    logServerError("Could not save the custom sample", error, {
      profileId: me.id,
      recordId: form.id,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/custom-samples");
  return { error: null };
}

/** Deletes a sample that was never lent or given away. */
export async function deleteCustomSample(
  id: string,
): Promise<CustomSampleResult> {
  const me = await requirePage("tuft");
  if (!keepsCustomSamples(me.jobRole)) return { error: NOT_KEEPER };
  const parsed = sampleId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_samples")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    logServerError("Could not delete the custom sample", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) {
    return { error: "A sample that was lent or given away stays on record." };
  }

  revalidatePath("/custom-samples");
  return { error: null };
}

/**
 * Lends an available sample. A salesperson borrows for themselves; the MD names the
 * salesperson. The database sets the return-by date from the loan period.
 */
export async function borrowCustomSample(
  input: unknown,
): Promise<BorrowResult> {
  const me = await requirePage("tuft");
  if (!canBorrowCustomSample(me)) return { error: NOT_BORROWER };
  const parsed = borrowSampleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;
  const salespersonId = isCustomSampleSeller(me) ? me.id : form.salespersonId;
  if (!salespersonId) return { error: "Choose the salesperson." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_sample_loans")
    .insert({
      sample_id: form.sampleId,
      salesperson_id: salespersonId,
      customer: form.customer,
      project: form.project,
      out_on: form.outOn,
    })
    .select("due_on")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Already on loan." };
    if (error.code === "23503") return { error: NOT_FOUND };
    const plain = plainRefusal(error);
    if (plain) return { error: plain };
    if (error.code === "42501") return { error: NOT_BORROWER };
    logServerError("Could not lend the custom sample", error, {
      profileId: me.id,
      recordId: form.sampleId,
    });
    return { error: TRY_AGAIN };
  }

  revalidatePath("/custom-samples");
  return {
    error: null,
    dueOn: z.object({ due_on: z.iso.date() }).parse(data).due_on,
  };
}

/** A short-lived link to a sample's photo, for the detail sheet. */
export async function openCustomSamplePhoto(
  id: string,
): Promise<PhotoLinkResult> {
  await requirePage("tuft");
  const parsed = sampleId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_samples")
    .select("photo_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error) {
    logServerError("Could not look up the custom sample photo", error, {
      recordId: parsed.data,
    });
    return { error: "That photo is not available." };
  }
  const row = z.object({ photo_path: z.string() }).safeParse(data);
  if (!row.success) return { error: "That photo is not available." };

  const admin = createAdminClient();
  if (!admin)
    return { error: "Photos open on the preview link or the live site." };
  const link = await createReadLink(admin, row.data.photo_path);
  return link.ok ? { error: null, url: link.url } : { error: link.error };
}
