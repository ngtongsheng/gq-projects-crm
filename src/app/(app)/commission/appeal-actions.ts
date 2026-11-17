"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canDecideCommissionAppeal } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { loadCommissionLines } from "./commission-data";

export type AppealResult = { error: string | null };

const NOT_FOUND_ORDER = "Could not find that order. Reload the page.";
const NOT_FOUND_APPEAL =
  "Could not find that appeal. It may already be decided. Reload the page.";
const NOT_ALLOWED = "Only the MD and HR & Accounts can decide an appeal.";
const TRY_AGAIN = "Could not save. Try again.";

const appealForm = z.object({
  mofId: z.uuid({ error: NOT_FOUND_ORDER }),
  reason: z
    .string()
    .trim()
    .min(10, "Explain the reason in a sentence or two.")
    .max(1000, "Keep the reason under 1,000 characters."),
});

const decisionForm = z.object({
  appealId: z.uuid({ error: NOT_FOUND_APPEAL }),
  decision: z.enum(["approved", "rejected"], {
    error: "Choose approve or reject.",
  }),
  reply: z
    .string()
    .trim()
    .min(1, "Write a short note.")
    .max(500, "Keep the note under 500 characters."),
});

/** A salesperson asks to waive the late-collection cut on their own commission for one order. */
export async function sendAppeal(formData: FormData): Promise<AppealResult> {
  const me = await requirePage("comm");

  const parsed = appealForm.safeParse({
    mofId: textField(formData, "mofId"),
    reason: textField(formData, "reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const appeal = parsed.data;

  const hasCommission = (await loadCommissionLines(appeal.mofId)).some(
    (line) => line.personId === me.id,
  );
  if (!hasCommission) return { error: "You have no commission on this order." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("commission_appeals")
    .insert({ mof_id: appeal.mofId, reason: appeal.reason });
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "You already have an appeal waiting or approved on this order. Reload the page.",
      };
    }
    if (error.code === "23503") return { error: NOT_FOUND_ORDER };
    logServerError("Could not send the commission appeal", error, {
      profileId: me.id,
      recordId: appeal.mofId,
    });
    return { error: TRY_AGAIN };
  }

  revalidatePath("/commission");
  return { error: null };
}

/**
 * The MD or HR & Accounts approves or rejects a pending appeal, with a note to the salesperson.
 * Approving sets that person's late cut on the order to 0.
 */
export async function decideAppeal(formData: FormData): Promise<AppealResult> {
  const me = await requirePage("comm");
  if (!canDecideCommissionAppeal(me.jobRole)) return { error: NOT_ALLOWED };

  const parsed = decisionForm.safeParse({
    appealId: textField(formData, "appealId"),
    decision: textField(formData, "decision"),
    reply: textField(formData, "reply"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const decision = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("commission_appeals")
    .update({ status: decision.decision, reply: decision.reply })
    .eq("id", decision.appealId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    logServerError("Could not decide the commission appeal", error, {
      profileId: me.id,
      recordId: decision.appealId,
    });
    return { error: TRY_AGAIN };
  }
  // Already decided, someone else's to see, or the decider's own commission: RLS hides the row.
  if (data.length === 0) return { error: NOT_FOUND_APPEAL };

  revalidatePath("/commission");
  return { error: null };
}
