"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { createClient } from "@/lib/supabase/server";
import { type SubmitClaimResult, submitClaim } from "./actions";
import { openOwnClaim, TRY_AGAIN } from "./own-claim";

const note = z
  .string()
  .trim()
  .max(1000, "Keep the note under 1000 characters.");

/**
 * Saves the person's note to HR & Accounts (an explanation or an appeal) on their claim for the
 * month, then submits it. A claim with only overtime has no row yet, so it is started here.
 */
export async function submitOwnClaim(
  month: string,
  noteText: string,
): Promise<SubmitClaimResult> {
  const me = await requirePage("claims");
  const parsedMonth = z.iso.date().safeParse(month);
  const parsedNote = note.safeParse(noteText);
  if (!canFileClaim(me) || !parsedMonth.success) {
    return { error: TRY_AGAIN, afterCutOff: false };
  }
  if (!parsedNote.success) {
    return {
      error: parsedNote.error.issues[0]?.message ?? TRY_AGAIN,
      afterCutOff: false,
    };
  }

  const supabase = await createClient();
  const opened = await openOwnClaim(supabase, me, parsedMonth.data);
  if (opened.error !== null) return { error: opened.error, afterCutOff: false };

  const { error } = await supabase
    .from("monthly_claims")
    .update({ note: parsedNote.data })
    .eq("id", opened.claimId);
  if (error) {
    console.error("Could not save the claim note", error);
    return { error: TRY_AGAIN, afterCutOff: false };
  }
  revalidatePath("/claims");
  return submitClaim(opened.claimId);
}
