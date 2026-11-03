"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditRegister, isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import {
  type MofForm,
  type MofLine,
  mofCostSchema,
  mofFormSchema,
  mofIdSchema,
  mofTotalChangeSchema,
} from "./schemas";

export type MofResult = { error: string | null; mofId?: string };

type DbError = { code?: string; message?: string };

const fail = (error: string): MofResult => ({ error });

const RELOAD = "Could not find that MOF. Reload the page.";
const NOT_EDITOR =
  "Only the MD, Purchasing or HR & Accounts can register or change an MOF.";
const NOT_MANAGER = "Only the MD and HR & Accounts can see or set the cost.";
const TRY_AGAIN = "Could not save the MOF. Try again.";

// The lines editor posts its rows as JSON; an id marks a line that is already saved.
const postedLines = z.array(
  z.object({
    id: z.union([z.literal(""), z.uuid()]).optional(),
    product: z.string(),
    stockType: z.string(),
    supplier: z.string(),
    qty: z.string(),
    unit: z.string(),
    areaM2: z.string(),
  }),
);

function readLines(text: string): z.infer<typeof postedLines> | null {
  try {
    const parsed = postedLines.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const existingMofRow = z.object({
  contract_sum: z.number(),
  vo_amount: z.number(),
});

const mofColumns = (form: MofForm) => ({
  mof_no: form.mofNo,
  loa_date: form.loaDate,
  salesperson_id: form.salespersonId,
  second_salesperson_id: form.secondSalespersonId,
  project_id: form.projectId,
  company_name: form.companyName,
  project_name: form.projectName,
  loa_no: form.loaNo,
  quote_no: form.quoteNo,
  site_address: form.siteAddress,
  site_contact_name: form.siteContactName,
  site_contact_mobile: form.siteContactMobile,
  office_pic_id: form.officePicId,
  customer_contact: form.customerContact,
  accounts_contact: form.accountsContact,
  scope: form.scope,
  installer_name: form.installerName,
  retention_pct: form.retentionPct,
  invoice_no: form.invoiceNo,
  invoice_date: form.invoiceDate,
  commission_type: form.commissionType,
  delivery_date: form.deliveryDate,
  stage: form.stage,
  latest_update: form.latestUpdate,
  payment_checked: form.paymentChecked,
  approvals_in_writing: form.approvalsInWriting,
  artwork_signed_off: form.artworkSignedOff,
  dos_pre_approved: form.dosPreApproved,
});

const lineColumns = (line: MofLine) => ({
  product: line.product,
  stock_type: line.stockType,
  supplier: line.supplier,
  qty: line.qty,
  unit: line.unit,
  area_m2: line.areaM2,
});

/** A plain message for a refusal from the database; anything else is logged. */
function dbMessage(error: DbError): string {
  if (error.code === "42501") {
    return error.message?.includes("mof_costs") ? NOT_MANAGER : NOT_EDITOR;
  }
  if (error.code === "23505") {
    return error.message?.includes("project_id")
      ? "That project already has an MOF."
      : "That MOF number is already registered. Check the MOF number.";
  }
  if (error.code === "P0002") return RELOAD;
  console.error("Could not save MOF", error);
  return TRY_AGAIN;
}

/** Registers an MOF, or changes one when the form carries a mofId. */
export async function saveMof(formData: FormData): Promise<MofResult> {
  const me = await requireSection("mof");
  if (!canEditRegister(me.jobRole)) return fail(NOT_EDITOR);

  const mofId = textField(formData, "mofId") || null;
  if (mofId && !mofIdSchema.safeParse(mofId).success) return fail(RELOAD);

  // Cost is managers-only; a posted cost from anyone else is refused, not ignored.
  const costText = formData.has("cost") ? textField(formData, "cost") : "";
  if (formData.has("cost") && !isManager(me.jobRole)) return fail(NOT_MANAGER);
  let cost: number | null = null;
  if (costText.trim() !== "") {
    const parsedCost = mofCostSchema.shape.cost.safeParse(costText);
    if (!parsedCost.success) {
      return fail(parsedCost.error.issues[0]?.message ?? "Check the cost.");
    }
    cost = parsedCost.data;
  }

  const lines = readLines(textField(formData, "lines"));
  if (!lines) return fail("Check the product lines and try again.");

  const parsed = mofFormSchema.safeParse({
    mofNo: textField(formData, "mofNo"),
    loaDate: textField(formData, "loaDate"),
    salespersonId: textField(formData, "salespersonId"),
    secondSalespersonId: textField(formData, "secondSalespersonId"),
    projectId: textField(formData, "projectId"),
    companyName: textField(formData, "companyName"),
    projectName: textField(formData, "projectName"),
    loaNo: textField(formData, "loaNo"),
    quoteNo: textField(formData, "quoteNo"),
    siteAddress: textField(formData, "siteAddress"),
    siteContactName: textField(formData, "siteContactName"),
    siteContactMobile: textField(formData, "siteContactMobile"),
    officePicId: textField(formData, "officePicId"),
    customerContact: textField(formData, "customerContact"),
    accountsContact: textField(formData, "accountsContact"),
    scope: textField(formData, "scope"),
    installerName: textField(formData, "installerName"),
    contractSum: textField(formData, "contractSum"),
    voAmount: textField(formData, "voAmount"),
    retentionPct: textField(formData, "retentionPct"),
    invoiceNo: textField(formData, "invoiceNo"),
    invoiceDate: textField(formData, "invoiceDate"),
    commissionType: textField(formData, "commissionType"),
    deliveryDate: textField(formData, "deliveryDate"),
    stage: textField(formData, "stage"),
    latestUpdate: textField(formData, "latestUpdate"),
    paymentChecked: formData.get("paymentChecked") ?? undefined,
    approvalsInWriting: formData.get("approvalsInWriting") ?? undefined,
    artworkSignedOff: formData.get("artworkSignedOff") ?? undefined,
    dosPreApproved: formData.get("dosPreApproved") ?? undefined,
    lines: lines.map(({ id: _id, ...line }) => line),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const form = parsed.data;
  const lineIds = lines.map((line) => line.id ?? "");
  if (!mofId && lineIds.some((id) => id !== "")) return fail(RELOAD);
  const supabase = await createClient();

  // Contract sum and VO of a saved MOF change only through update_mof_total, which needs a reason.
  let reason = "";
  if (mofId) {
    const { data: existingData, error: loadError } = await supabase
      .from("mofs")
      .select("contract_sum, vo_amount")
      .eq("id", mofId)
      .maybeSingle();
    if (loadError) return fail(dbMessage(loadError));
    if (!existingData) return fail(RELOAD);
    const existing = existingMofRow.parse(existingData);
    if (
      existing.contract_sum !== form.contractSum ||
      existing.vo_amount !== form.voAmount
    ) {
      const change = mofTotalChangeSchema.safeParse({
        mofId,
        contractSum: textField(formData, "contractSum"),
        voAmount: textField(formData, "voAmount"),
        reason: textField(formData, "reason"),
      });
      if (!change.success) {
        return fail(change.error.issues[0]?.message ?? "Give the reason.");
      }
      reason = change.data.reason;
    }
  }

  // One call, one transaction: a failure part-way saves nothing.
  const { data, error } = await supabase.rpc("save_mof", {
    mof_id: mofId,
    mof: {
      ...mofColumns(form),
      contract_sum: form.contractSum,
      vo_amount: form.voAmount,
    },
    lines: form.lines.map((line, index) => ({
      id: lineIds[index] || null,
      ...lineColumns(line),
    })),
    reason,
    cost,
  });
  if (error) return fail(dbMessage(error));
  const savedId = z.uuid().parse(data);

  revalidatePath("/mofs");
  if (mofId) revalidatePath(`/mofs/${mofId}`);
  return { error: null, mofId: savedId };
}
