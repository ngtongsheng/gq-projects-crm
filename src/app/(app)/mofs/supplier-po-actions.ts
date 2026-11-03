"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditRegister } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { SUPPLIER_PO_STATUSES } from "@/lib/domain/supplier-po";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { mofIdSchema } from "./schemas";

export type SupplierPoResult = { error: string | null };

const NOT_EDITOR =
  "Only the MD, Purchasing or HR & Accounts can change supplier POs.";
const TRY_AGAIN = "Could not save the supplier PO. Try again.";

const supplierPoForm = z.object({
  mofId: mofIdSchema,
  zohoNo: z
    .string()
    .trim()
    .regex(
      /^\d{4}$/,
      "Key in only the 4-digit Zoho running no., e.g. 2210. The MOF number is added in front.",
    ),
  supplier: z.string().trim().min(1, "Enter the supplier.").max(100),
  poDate: z.iso.date("Choose the PO date."),
  leadTimeDays: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, "Enter the lead time as a whole number of days.")
    .transform(Number)
    .pipe(z.number().max(3650, "Check the lead time.")),
  status: z.enum(SUPPLIER_PO_STATUSES, "Choose the status."),
  notes: z
    .string()
    .trim()
    .max(300, "Keep the notes under 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});

/** Adds a supplier PO to an MOF, or changes one when the form carries a poId. */
export async function saveSupplierPo(
  formData: FormData,
): Promise<SupplierPoResult> {
  const me = await requireSection("mof");
  if (!canEditRegister(me.jobRole)) return { error: NOT_EDITOR };

  const poId = textField(formData, "poId");
  if (poId !== "" && !z.uuid().safeParse(poId).success) {
    return { error: "Could not find that supplier PO. Reload the page." };
  }

  const parsed = supplierPoForm.safeParse({
    mofId: textField(formData, "mofId"),
    zohoNo: textField(formData, "zohoNo"),
    supplier: textField(formData, "supplier"),
    poDate: textField(formData, "poDate"),
    leadTimeDays: textField(formData, "leadTimeDays"),
    status: textField(formData, "status"),
    notes: textField(formData, "notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { mofId, zohoNo, supplier, poDate, leadTimeDays, status, notes } =
    parsed.data;
  const columns = {
    zoho_no: zohoNo,
    supplier,
    po_date: poDate,
    lead_time_days: leadTimeDays,
    status,
    notes,
  };

  const supabase = await createClient();
  const { data, error } =
    poId === ""
      ? await supabase
          .from("supplier_pos")
          .insert({ mof_id: mofId, ...columns })
          .select("id")
      : await supabase
          .from("supplier_pos")
          .update(columns)
          .eq("id", poId)
          .eq("mof_id", mofId)
          .select("id");

  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23505") {
      return {
        error: `Running no. ${zohoNo} is already used by another supplier PO. Check Zoho.`,
      };
    }
    console.error("Could not save supplier PO", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) {
    return { error: "Could not find that supplier PO. Reload the page." };
  }

  revalidatePath("/mofs");
  revalidatePath(`/mofs/${mofId}`);
  return { error: null };
}
