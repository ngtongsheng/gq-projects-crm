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

type Supabase = Awaited<ReturnType<typeof createClient>>;
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
function dbMessage(error: DbError, context: string): string {
  if (error.code === "42501") return NOT_EDITOR;
  if (error.code === "23505") {
    return error.message?.includes("project_id")
      ? "That project already has an MOF."
      : "That MOF number is already registered. Check the MOF number.";
  }
  console.error(context, error);
  return TRY_AGAIN;
}

/** Brings the MOF's saved lines in line with the form: removed lines go, kept ones change, new ones are added. */
async function saveLines(
  supabase: Supabase,
  mofId: string,
  lines: MofLine[],
  ids: string[],
): Promise<string | null> {
  const keptIds = ids.filter((id) => id !== "");
  const removal = supabase.from("mof_lines").delete().eq("mof_id", mofId);
  const { error: removeError } = await (keptIds.length > 0
    ? removal.not("id", "in", `(${keptIds.join(",")})`)
    : removal);
  if (removeError) return dbMessage(removeError, "Could not remove MOF lines");

  const added = [];
  for (const [index, line] of lines.entries()) {
    const id = ids[index] ?? "";
    if (id === "") {
      added.push({ mof_id: mofId, ...lineColumns(line) });
      continue;
    }
    const { error } = await supabase
      .from("mof_lines")
      .update(lineColumns(line))
      .eq("id", id)
      .eq("mof_id", mofId);
    if (error) return dbMessage(error, "Could not update MOF line");
  }
  if (added.length > 0) {
    const { error } = await supabase.from("mof_lines").insert(added);
    if (error) return dbMessage(error, "Could not add MOF lines");
  }
  return null;
}

/** mof_costs has no update grant on mof_id, so an upsert would be refused: update, then add if there was none. */
async function saveCost(
  supabase: Supabase,
  mofId: string,
  cost: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mof_costs")
    .update({ cost })
    .eq("mof_id", mofId)
    .select("mof_id");
  if (error) return dbMessage(error, "Could not update MOF cost");
  if (data.length > 0) return null;
  const { error: insertError } = await supabase
    .from("mof_costs")
    .insert({ mof_id: mofId, cost });
  if (!insertError) return null;
  return insertError.code === "42501"
    ? NOT_MANAGER
    : dbMessage(insertError, "Could not add MOF cost");
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
  const supabase = await createClient();

  if (!mofId) {
    if (lineIds.some((id) => id !== "")) return fail(RELOAD);
    const { data, error } = await supabase
      .from("mofs")
      .insert({
        ...mofColumns(form),
        contract_sum: form.contractSum,
        vo_amount: form.voAmount,
      })
      .select("id")
      .single();
    if (error) return fail(dbMessage(error, "Could not register MOF"));
    const newId = z.object({ id: z.string() }).parse(data).id;
    const lineError = await saveLines(supabase, newId, form.lines, lineIds);
    if (lineError) return fail(lineError);
    if (cost !== null) {
      const costError = await saveCost(supabase, newId, cost);
      if (costError) return fail(costError);
    }
    revalidatePath("/mofs");
    return { error: null, mofId: newId };
  }

  const { data: existingData, error: loadError } = await supabase
    .from("mofs")
    .select("contract_sum, vo_amount")
    .eq("id", mofId)
    .maybeSingle();
  if (loadError) return fail(dbMessage(loadError, "Could not load MOF"));
  if (!existingData) return fail(RELOAD);
  const existing = existingMofRow.parse(existingData);

  // Contract sum and VO change only through update_mof_total, which needs a reason.
  const totalChanged =
    existing.contract_sum !== form.contractSum ||
    existing.vo_amount !== form.voAmount;
  let reason = "";
  if (totalChanged) {
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

  const { data: updated, error: updateError } = await supabase
    .from("mofs")
    .update(mofColumns(form))
    .eq("id", mofId)
    .select("id");
  if (updateError) return fail(dbMessage(updateError, "Could not update MOF"));
  if (updated.length === 0) return fail(NOT_EDITOR);

  const lineError = await saveLines(supabase, mofId, form.lines, lineIds);
  if (lineError) return fail(lineError);

  if (totalChanged) {
    const { error } = await supabase.rpc("update_mof_total", {
      mof_id: mofId,
      contract_sum: form.contractSum,
      vo_amount: form.voAmount,
      reason,
    });
    if (error) return fail(dbMessage(error, "Could not change order total"));
  }

  if (cost !== null) {
    const costError = await saveCost(supabase, mofId, cost);
    if (costError) return fail(costError);
  }

  revalidatePath("/mofs");
  revalidatePath(`/mofs/${mofId}`);
  return { error: null, mofId };
}
