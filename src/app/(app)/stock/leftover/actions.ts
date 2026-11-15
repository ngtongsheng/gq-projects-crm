"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditStock } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  canRecordLeftover,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_STATUSES,
  leftoverDestinationDetails,
  leftoverProblem,
  leftoverTransportDetails,
  leftoverTransportProblem,
} from "@/lib/domain/leftover";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import {
  keepReasonField,
  optionalRmAmount,
  orderedWrongByField,
  returnMethodField,
  transportFields,
} from "./leftover-fields";
import { leftoverRecordSchema } from "./leftover-record-schema";

export type LeftoverResult = { error: string | null };

const NOT_RECORDER =
  "Only a site supervisor or the people who arrange stock can record leftover stock.";
const NOT_STOCK =
  "Only the people who arrange stock can update leftover stock.";
const NOT_FOUND_MOF = "Could not find that MOF. Reload the page.";
const NOT_FOUND_LEFTOVER = "Could not find that item. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const updateForm = z.object({
  leftoverId: z.uuid({ error: NOT_FOUND_LEFTOVER }),
  condition: z.enum(LEFTOVER_CONDITIONS, "Choose the condition."),
  destination: z.enum(LEFTOVER_DESTINATIONS, "Choose where it goes."),
  status: z.enum(LEFTOVER_STATUSES, "Choose the status."),
  creditNoteNo: optionalText(
    60,
    "Keep the credit note number under 60 characters.",
  ),
  creditNoteAmount: optionalRmAmount(
    "Enter the credit note amount as a number, e.g. 1234.50.",
  ),
  note: optionalText(300, "Keep the note under 300 characters."),
  returnMethod: returnMethodField,
  supplier: optionalText(100, "Keep the supplier under 100 characters."),
  keepReason: keepReasonField,
  orderedWrongBy: orderedWrongByField,
  collectedTo: optionalText(100, "Keep where it went under 100 characters."),
  ...transportFields,
});

/** Records an item left over at a site, waiting for pickup. The database checks the job role again. */
export async function recordLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requirePage("site");
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

/** Moves an item along: status, where it goes and how, transport, the supplier's credit note. */
export async function updateLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = updateForm.safeParse({
    leftoverId: textField(formData, "leftoverId"),
    condition: textField(formData, "condition"),
    destination: textField(formData, "destination"),
    status: textField(formData, "status"),
    creditNoteNo: textField(formData, "creditNoteNo"),
    creditNoteAmount: textField(formData, "creditNoteAmount"),
    note: textField(formData, "note"),
    returnMethod: textField(formData, "returnMethod"),
    supplier: textField(formData, "supplier"),
    keepReason: textField(formData, "keepReason"),
    orderedWrongBy: textField(formData, "orderedWrongBy"),
    collectedTo: textField(formData, "collectedTo"),
    transportBy: textField(formData, "transportBy"),
    transportOn: textField(formData, "transportOn"),
    transportTo: textField(formData, "transportTo"),
    transportCost: textField(formData, "transportCost"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const leftover = parsed.data;

  const problem = leftoverProblem(leftover);
  if (problem) return { error: problem };
  // The database refuses the other side's values when the destination flips.
  const destination = leftoverDestinationDetails(
    leftover.destination,
    leftover,
  );
  const transport = leftoverTransportDetails(leftover.returnMethod, {
    by: leftover.transportBy,
    on: leftover.transportOn,
    to: leftover.transportTo,
    cost: leftover.transportCost,
  });
  const transportProblem = leftoverTransportProblem(transport);
  if (transportProblem) return { error: transportProblem };

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
      return_method: leftover.returnMethod,
      supplier: destination.supplier,
      keep_reason: destination.keepReason,
      ordered_wrong_by: destination.orderedWrongBy,
      collected_to: leftover.collectedTo,
      transport_by: transport.by,
      transport_on: transport.on,
      transport_to: transport.to,
      transport_cost: transport.cost,
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
