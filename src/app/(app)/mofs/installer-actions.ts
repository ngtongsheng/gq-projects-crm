"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canEditRegister,
  canEditSite,
  canEnterPayments,
} from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  exceedsInstallerPo,
  INSTALLER_CLAIM_TYPES,
} from "@/lib/domain/installer-claim";
import { optionalId, optionalText, textField } from "@/lib/form/form-fields";
import { formatRm, parseRm, sumRm } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { mofIdSchema } from "./schemas";

export type InstallerResult = { error: string | null };

const NOT_EDITOR =
  "Only the MD, Purchasing or HR & Accounts can change installer POs and claims.";
const NOT_VERIFIER = "Only a Site Supervisor can verify installer work.";
const NOT_PAYER = "Only the MD or HR & Accounts can record a payment.";
const NOT_FOUND_PO = "Could not find that installer PO. Reload the page.";
const NOT_FOUND_CLAIM = "Could not find that claim. Reload the page.";

const amountField = (message: string) =>
  z
    .string()
    .trim()
    .transform((value) => parseRm(value))
    .pipe(z.number({ error: message }).positive(message));

const installerPoForm = z.object({
  mofId: mofIdSchema,
  poNo: z.string().trim().min(1, "Enter the installer PO no.").max(50),
  poDate: z.iso.date("Choose the PO date."),
  installer: z.string().trim().min(1, "Enter the installer.").max(100),
  amount: amountField("Enter the PO amount, more than RM 0."),
  scope: optionalText(200, "Keep the scope under 200 characters."),
  retentionPct: z
    .string()
    .trim()
    .regex(
      /^\d{1,3}(\.\d{1,2})?$/,
      "Enter the retention as a percentage, e.g. 5.",
    )
    .transform(Number)
    .pipe(z.number().max(100, "Retention cannot be more than 100%.")),
});

/** Adds an installer PO to an MOF, or changes one when the form carries a poId. */
export async function saveInstallerPo(
  formData: FormData,
): Promise<InstallerResult> {
  const me = await requirePage("mof");
  if (!canEditRegister(me.jobRole)) return { error: NOT_EDITOR };

  const poId = textField(formData, "poId");
  if (!optionalId().safeParse(poId).success) return { error: NOT_FOUND_PO };

  const parsed = installerPoForm.safeParse({
    mofId: textField(formData, "mofId"),
    poNo: textField(formData, "poNo"),
    poDate: textField(formData, "poDate"),
    installer: textField(formData, "installer"),
    amount: textField(formData, "amount"),
    scope: textField(formData, "scope"),
    retentionPct: textField(formData, "retentionPct"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { mofId, poNo, poDate, installer, amount, scope, retentionPct } =
    parsed.data;
  const columns = {
    po_no: poNo,
    po_date: poDate,
    installer,
    amount,
    scope,
    retention_pct: retentionPct,
  };

  const supabase = await createClient();
  const { data, error } =
    poId === ""
      ? await supabase
          .from("installer_pos")
          .insert({ mof_id: mofId, ...columns })
          .select("id")
      : await supabase
          .from("installer_pos")
          .update(columns)
          .eq("id", poId)
          .eq("mof_id", mofId)
          .select("id");

  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23505") {
      return {
        error: `${installer} already has an installer PO on this MOF. Edit that one instead.`,
      };
    }
    console.error("Could not save installer PO", error);
    return { error: "Could not save the installer PO. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND_PO };

  revalidatePath(`/mofs/${mofId}`);
  return { error: null };
}

const installerClaimForm = z.object({
  mofId: mofIdSchema,
  installerPoId: z.uuid({ error: NOT_FOUND_PO }),
  type: z.enum(INSTALLER_CLAIM_TYPES, "Choose the claim type."),
  claimNo: optionalText(50, "Keep the claim no. under 50 characters."),
  amount: amountField("Enter the amount, more than RM 0."),
  claimedOn: z.iso.date("Choose the claim date."),
});

/** Must match the message in the cap_installer_claims trigger. */
const OVER_PO =
  "These claims add up to more than the installer PO. If there is extra work, increase the PO amount first.";

const claimRows = z.array(
  z.object({ id: z.string(), claim_type: z.string(), amount: z.number() }),
);
const poRow = z.array(z.object({ amount: z.number() }));

/** Records a claim against an installer PO, or changes one when the form carries a claimId. */
export async function saveInstallerClaim(
  formData: FormData,
): Promise<InstallerResult> {
  const me = await requirePage("mof");
  if (!canEditRegister(me.jobRole)) return { error: NOT_EDITOR };

  const claimId = textField(formData, "claimId");
  if (!optionalId().safeParse(claimId).success)
    return { error: NOT_FOUND_CLAIM };

  const parsed = installerClaimForm.safeParse({
    mofId: textField(formData, "mofId"),
    installerPoId: textField(formData, "installerPoId"),
    type: textField(formData, "type"),
    claimNo: textField(formData, "claimNo"),
    amount: textField(formData, "amount"),
    claimedOn: textField(formData, "claimedOn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { mofId, installerPoId, type, claimNo, amount, claimedOn } =
    parsed.data;

  const supabase = await createClient();
  if (type !== "deduction") {
    const [poResult, claimsResult] = await Promise.all([
      supabase
        .from("installer_pos")
        .select("amount")
        .eq("id", installerPoId)
        .eq("mof_id", mofId),
      supabase
        .from("installer_claims")
        .select("id, claim_type, amount")
        .eq("installer_po_id", installerPoId),
    ]);
    if (poResult.error || claimsResult.error) {
      console.error(
        "Could not check the installer PO",
        poResult.error ?? claimsResult.error,
      );
      return { error: "Could not save the claim. Try again." };
    }
    const po = poRow.parse(poResult.data)[0];
    if (!po) return { error: NOT_FOUND_PO };
    const others = claimRows
      .parse(claimsResult.data)
      .filter(
        (claim) => claim.claim_type !== "deduction" && claim.id !== claimId,
      )
      .map((claim) => claim.amount);
    const otherClaimed = sumRm(others);
    if (exceedsInstallerPo(po.amount, otherClaimed, amount)) {
      return {
        error: `This takes the claims to ${formatRm(sumRm([otherClaimed, amount]))}, more than the installer PO of ${formatRm(po.amount)}. If there is extra work, increase the PO amount first.`,
      };
    }
  }

  const columns = {
    claim_type: type,
    claim_no: claimNo,
    amount,
    claimed_on: claimedOn,
  };
  const { data, error } =
    claimId === ""
      ? await supabase
          .from("installer_claims")
          .insert({ installer_po_id: installerPoId, ...columns })
          .select("id")
      : await supabase
          .from("installer_claims")
          .update(columns)
          .eq("id", claimId)
          .eq("installer_po_id", installerPoId)
          .select("id");

  if (error) {
    // Another claim saved at the same moment took the PO past its amount; the database says so plainly.
    if (error.code === "23514" && error.message === OVER_PO) {
      return { error: OVER_PO };
    }
    if (error.code === "42501") {
      return {
        error: error.message.includes("paid")
          ? "A paid claim cannot be changed."
          : NOT_EDITOR,
      };
    }
    console.error("Could not save installer claim", error);
    return { error: "Could not save the claim. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND_CLAIM };

  revalidatePath(`/mofs/${mofId}`);
  return { error: null };
}

/**
 * A Site Supervisor confirms the claimed work is done. The database stamps who and when.
 * Gated on Site Work, not the MOF register: supervisors cannot open the register.
 */
export async function verifyInstallerClaim(
  mofId: string,
  claimId: string,
): Promise<InstallerResult> {
  const me = await requirePage("site");
  if (!canEditSite(me.jobRole)) return { error: NOT_VERIFIER };
  if (
    !mofIdSchema.safeParse(mofId).success ||
    !z.uuid().safeParse(claimId).success
  ) {
    return { error: NOT_FOUND_CLAIM };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installer_claims")
    .update({
      verified_by: me.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .neq("claim_type", "deduction")
    .select("id");

  if (error) {
    if (error.code === "42501") return { error: NOT_VERIFIER };
    console.error("Could not verify installer claim", error);
    return { error: "Could not verify the claim. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND_CLAIM };

  revalidatePath(`/mofs/${mofId}`);
  // Site supervisors verify from Site Work, which lists the pending claims.
  revalidatePath("/site-work");
  return { error: null };
}

const paymentForm = z.object({
  mofId: mofIdSchema,
  claimId: z.uuid({ error: NOT_FOUND_CLAIM }),
  paidAmount: amountField("Enter the amount paid, more than RM 0."),
  paidOn: z.iso.date("Choose the date paid."),
});

/** HR & Accounts records the payment made against a verified claim. */
export async function recordInstallerPayment(
  formData: FormData,
): Promise<InstallerResult> {
  const me = await requirePage("mof");
  if (!canEnterPayments(me.jobRole)) return { error: NOT_PAYER };

  const parsed = paymentForm.safeParse({
    mofId: textField(formData, "mofId"),
    claimId: textField(formData, "claimId"),
    paidAmount: textField(formData, "paidAmount"),
    paidOn: textField(formData, "paidOn"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { mofId, claimId, paidAmount, paidOn } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("installer_claims")
    .update({ paid_amount: paidAmount, paid_on: paidOn })
    .eq("id", claimId)
    .select("id");

  if (error) {
    if (error.code === "42501") return { error: NOT_PAYER };
    if (error.code === "23514") {
      return {
        error: error.message.includes("verify")
          ? "The site supervisor must verify the work before payment."
          : "The amount paid cannot be more than the claim, and a deduction is not paid.",
      };
    }
    console.error("Could not record installer payment", error);
    return { error: "Could not record the payment. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND_CLAIM };

  revalidatePath(`/mofs/${mofId}`);
  return { error: null };
}
