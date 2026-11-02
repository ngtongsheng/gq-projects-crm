"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditStock } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import {
  canRecordLeftover,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_STATUSES,
  leftoverProblem,
} from "@/lib/domain/leftover";
import { parseRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { leftoverRecordSchema } from "./leftover-record-schema";

export type LeftoverResult = { error: string | null };

const NOT_RECORDER =
  "Only a site supervisor or the people who arrange stock can record leftover stock.";
const NOT_STOCK =
  "Only the people who arrange stock can update leftover stock.";
const NOT_FOUND_MOF = "Could not find that MOF. Reload the page.";
const NOT_FOUND_LEFTOVER = "Could not find that item. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const textField = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const creditNoteAmount = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const amount = parseRm(value);
    if (amount === null || amount < 0 || amount > 999_999_999_999) {
      ctx.addIssue({
        code: "custom",
        message: "Enter the credit note amount as a number, e.g. 1234.50.",
      });
      return z.NEVER;
    }
    return amount;
  });

const updateForm = z.object({
  leftoverId: z.uuid({ error: NOT_FOUND_LEFTOVER }),
  condition: z.enum(LEFTOVER_CONDITIONS, "Choose the condition."),
  destination: z.enum(LEFTOVER_DESTINATIONS, "Choose where it goes."),
  status: z.enum(LEFTOVER_STATUSES, "Choose the status."),
  creditNoteNo: optionalText(
    60,
    "Keep the credit note number under 60 characters.",
  ),
  creditNoteAmount,
  note: optionalText(300, "Keep the note under 300 characters."),
});

/** Records an item left over at a site, waiting for pickup. The database checks the job role again. */
export async function recordLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requireSection("siteWork");
  if (!canRecordLeftover(me)) return { error: NOT_RECORDER };

  const parsed = leftoverRecordSchema.safeParse({
    mofId: textField(formData, "mofId"),
    item: textField(formData, "item"),
    qty: textField(formData, "qty"),
    unit: textField(formData, "unit"),
    condition: textField(formData, "condition"),
    destination: textField(formData, "destination"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const leftover = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("leftovers").insert({
    mof_id: leftover.mofId,
    item: leftover.item,
    qty: leftover.qty,
    unit: leftover.unit,
    condition: leftover.condition,
    destination: leftover.destination,
    status: "pending_pickup",
    note: leftover.note,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_RECORDER };
    if (error.code === "23503") return { error: NOT_FOUND_MOF };
    console.error("Could not record the leftover stock", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/stock/leftover");
  revalidatePath(`/site-work/${leftover.mofId}`);
  return { error: null };
}

/** Moves an item along: status, where it goes, the supplier's credit note. */
export async function updateLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requireSection("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = updateForm.safeParse({
    leftoverId: textField(formData, "leftoverId"),
    condition: textField(formData, "condition"),
    destination: textField(formData, "destination"),
    status: textField(formData, "status"),
    creditNoteNo: textField(formData, "creditNoteNo"),
    creditNoteAmount: textField(formData, "creditNoteAmount"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const leftover = parsed.data;

  const problem = leftoverProblem(leftover);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leftovers")
    .update({
      condition: leftover.condition,
      destination: leftover.destination,
      status: leftover.status,
      note: leftover.note,
      credit_note_no: leftover.creditNoteNo,
      credit_note_amount: leftover.creditNoteAmount,
    })
    .eq("id", leftover.leftoverId)
    .select("id, mof_id");
  if (error) {
    if (error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not update the leftover stock", error);
    return { error: TRY_AGAIN };
  }
  const updated = data[0];
  if (!updated) return { error: NOT_FOUND_LEFTOVER };

  revalidatePath("/stock/leftover");
  revalidatePath(`/site-work/${updated.mof_id}`);
  return { error: null };
}
