"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { todayMyt } from "@/lib/format/date";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { keepsCustomSamples } from "./custom-sample-access";
import type { CustomSampleResult } from "./custom-sample-actions";
import { giveAwaySampleSchema } from "./custom-sample-input";
import { plainRefusal } from "./custom-sample-refusal";

const NOT_KEEPER = "Only the office confirms a return.";
const NOT_FOUND = "Could not find that sample. Reload the page.";
const NOT_OUT = "That sample is not out on loan any more. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const sampleId = z.uuid({ error: NOT_FOUND });

type LoanStep = "mark" | "confirm" | "reject";

/** The loan columns each step of the return changes (the database stamps who and when). */
function loanChange(step: LoanStep) {
  const today = todayMyt();
  if (step === "mark") return { returned_marked_on: today };
  if (step === "confirm") return { back_on: today };
  return { returned_marked_on: null };
}

/**
 * One step of the return on the sample's open loan. The database decides who may take each:
 * the borrower marks it returned; the office confirms, takes it back directly, or says it was
 * not received.
 */
async function stepReturn(
  id: string,
  step: LoanStep,
  refused: string,
): Promise<CustomSampleResult> {
  const me = await requirePage("tuft");
  if (step !== "mark" && !keepsCustomSamples(me.jobRole)) {
    return { error: NOT_KEEPER };
  }
  const parsed = sampleId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const open = supabase
    .from("custom_sample_loans")
    .update(loanChange(step))
    .eq("sample_id", parsed.data)
    .is("back_on", null);
  // Marking twice, or answering a return nobody marked, changes nothing.
  const { data, error } = await (step === "mark"
    ? open.is("returned_marked_on", null)
    : step === "reject"
      ? open.not("returned_marked_on", "is", null)
      : open
  ).select("id");
  if (error) {
    const plain = plainRefusal(error);
    if (plain) return { error: plain };
    if (error.code === "42501") return { error: refused };
    logServerError("Could not save the custom sample return", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_OUT };

  revalidatePath("/custom-samples");
  return { error: null };
}

/** The borrower's "I've returned it": the office has yet to confirm, but overdue stops counting. */
export async function markCustomSampleReturned(id: string) {
  return stepReturn(id, "mark", "Only the borrower marks the sample returned.");
}

/** "Received back": the sample is available again. Also the office's one-step return. */
export async function confirmCustomSampleBack(id: string) {
  return stepReturn(id, "confirm", NOT_KEEPER);
}

/** "Not received": back to On loan, and the database notes it. */
export async function rejectCustomSampleReturn(id: string) {
  return stepReturn(id, "reject", NOT_KEEPER);
}

/** Gives a sample away for good: to whom and why. The office, or the current borrower, may. */
export async function giveAwayCustomSample(
  input: unknown,
): Promise<CustomSampleResult> {
  const me = await requirePage("tuft");
  const parsed = giveAwaySampleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_samples")
    .update({ given_to: form.givenTo, gift_reason: form.reason })
    .eq("id", form.sampleId)
    .is("given_on", null)
    .select("id");
  if (error) {
    const plain = plainRefusal(error);
    if (plain) return { error: plain };
    if (error.code === "42501") {
      return { error: "Only the office or the borrower gives a sample away." };
    }
    logServerError("Could not give the custom sample away", error, {
      profileId: me.id,
      recordId: form.sampleId,
    });
    return { error: TRY_AGAIN };
  }
  // Already given away, or neither the office nor the borrower: the update sees no row.
  if (data.length === 0) {
    return {
      error:
        "This sample was already given away, or you cannot give it away. Reload the page.",
    };
  }

  revalidatePath("/custom-samples");
  return { error: null };
}
