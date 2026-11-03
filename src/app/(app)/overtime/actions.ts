"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canDecideOvertime } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import {
  decisionColumns,
  OT_CLAIM_TYPES,
  OT_DECISIONS,
} from "@/lib/domain/ot-claim";
import { otHours } from "@/lib/domain/ot-hours";
import { textField } from "@/lib/form/form-fields";
import { isClockTime } from "@/lib/format/clock-time";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type OvertimeResult = { error: string | null };

const NOT_DECIDER = "Only the MD or Sales Director can approve overtime.";
const NOT_FOUND_MOF = "Could not find that order. Reload the page.";
const NOT_FOUND_CLAIM =
  "This claim is already decided, is your own, or was not found. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const clock = (message: string) => z.string().refine(isClockTime, message);

const claimForm = z
  .object({
    workDate: z.iso.date("Choose the date you worked."),
    mofId: z.uuid({ error: "Choose the site you worked on." }),
    reason: z
      .string()
      .trim()
      .min(1, "Add the reason.")
      .max(300, "Keep the reason under 300 characters."),
    fromTime: clock("Enter the time you started."),
    toTime: clock("Enter the time you finished."),
    claimAs: z.enum(OT_CLAIM_TYPES, "Choose how you want to claim it."),
  })
  .refine((form) => form.fromTime !== form.toTime, {
    message: "The start and finish times are the same.",
    path: ["toTime"],
  })
  .refine((form) => otHours(form.fromTime, form.toTime) > 0, {
    message: "That is under 15 minutes, too short to claim.",
    path: ["toTime"],
  });

const decisionForm = z.object({
  claimId: z.uuid({ error: NOT_FOUND_CLAIM }),
  decision: z.enum(OT_DECISIONS, "Choose approve or reject."),
});

/** Files overtime for the signed-in person. The database works out the hours and sets who filed it. */
export async function submitOtClaim(
  formData: FormData,
): Promise<OvertimeResult> {
  await requireSection("overtime");

  const parsed = claimForm.safeParse({
    workDate: textField(formData, "workDate"),
    mofId: textField(formData, "mofId"),
    reason: textField(formData, "reason"),
    fromTime: textField(formData, "fromTime"),
    toTime: textField(formData, "toTime"),
    claimAs: textField(formData, "claimAs"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const claim = parsed.data;
  if (claim.workDate > todayMyt()) {
    return { error: "You cannot claim overtime for a day that has not come." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ot_claims").insert({
    work_date: claim.workDate,
    from_time: claim.fromTime,
    to_time: claim.toTime,
    mof_id: claim.mofId,
    reason: claim.reason,
    claim_as: claim.claimAs,
  });
  if (error) {
    if (error.code === "23503") return { error: NOT_FOUND_MOF };
    console.error("Could not save the overtime claim", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/overtime");
  return { error: null };
}

/**
 * Approves a claim as an OT claim or replacement leave, or rejects it. The database checks the
 * job role again, that the claim is still pending, and that it is not the decider's own.
 */
export async function decideOtClaim(
  claimId: string,
  decision: string,
): Promise<OvertimeResult> {
  const me = await requireSection("overtime");
  if (!canDecideOvertime(me.jobRole)) return { error: NOT_DECIDER };

  const parsed = decisionForm.safeParse({ claimId, decision });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ot_claims")
    .update(decisionColumns(parsed.data.decision))
    .eq("id", parsed.data.claimId)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_DECIDER };
    console.error("Could not decide the overtime claim", error);
    return { error: TRY_AGAIN };
  }
  // Row-level security hides a decided or own claim, so nothing was updated.
  if (data.length === 0) return { error: NOT_FOUND_CLAIM };

  revalidatePath("/overtime");
  return { error: null };
}
