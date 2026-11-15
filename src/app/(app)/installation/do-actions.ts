"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canScheduleJobs, canSetNextDoNumber } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { doItemsText, doLinesSchema } from "@/lib/domain/delivery-order";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { mofIdSchema } from "../mofs/schemas";

export type DoResult = { error: string | null };

const NOT_SCHEDULER =
  "Only the MD, Sales Director or Purchasing can change a DO.";
const NOT_FOUND = "Could not find that delivery. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const jobIdSchema = z.uuid({ error: NOT_FOUND });

function revalidateDoLists() {
  revalidatePath("/mofs");
  revalidatePath("/installation");
}

function revalidateDo(mofId: string) {
  revalidatePath(`/mofs/${mofId}`);
  revalidateDoLists();
}

/**
 * Saves the items on a delivery's DO, replacing the old ones in one step. Rows with no code,
 * description or quantity are dropped; the one-line summary on the DO is rebuilt from the rest.
 */
export async function saveDoLines(
  mofId: string,
  jobId: string,
  lines: unknown,
): Promise<DoResult> {
  const me = await requirePage("inst");
  if (!canScheduleJobs(me.jobRole)) return { error: NOT_SCHEDULER };
  if (
    !mofIdSchema.safeParse(mofId).success ||
    !jobIdSchema.safeParse(jobId).success
  ) {
    return { error: NOT_FOUND };
  }

  const parsed = doLinesSchema.safeParse(lines);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the items." };
  }

  const supabase = await createClient();
  // The job must belong to this MOF; the function itself only knows the job.
  const { data: found, error: findError } = await supabase
    .from("delivery_orders")
    .select("id")
    .eq("job_id", jobId)
    .eq("mof_id", mofId);
  if (findError) {
    console.error("Could not find the DO", findError);
    return { error: TRY_AGAIN };
  }
  if (found.length === 0) return { error: NOT_FOUND };

  const { error } = await supabase.rpc("replace_delivery_order_lines", {
    p_job_id: jobId,
    p_lines: parsed.data,
    p_items: parsed.data.length > 0 ? doItemsText(parsed.data) : null,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_SCHEDULER };
    console.error("Could not save the DO items", error);
    return { error: TRY_AGAIN };
  }

  revalidateDo(mofId);
  return { error: null };
}

/**
 * Cancels a DO: the delivery is postponed and its running no. is taken off, which puts the
 * number on the cancelled list for good. The job stays (jobs are never deleted).
 */
export async function cancelDo(
  mofId: string,
  jobId: string,
): Promise<DoResult> {
  const me = await requirePage("inst");
  if (!canScheduleJobs(me.jobRole)) return { error: NOT_SCHEDULER };
  if (
    !mofIdSchema.safeParse(mofId).success ||
    !jobIdSchema.safeParse(jobId).success
  ) {
    return { error: NOT_FOUND };
  }

  const supabase = await createClient();
  // Postponed first: a Done delivery cannot lose its number.
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .update({ status: "postponed" })
    .eq("id", jobId)
    .eq("mof_id", mofId)
    .eq("job_type", "delivery")
    .select("id");
  if (jobError) {
    if (jobError.code === "42501") return { error: NOT_SCHEDULER };
    console.error("Could not postpone the delivery", jobError);
    return { error: TRY_AGAIN };
  }
  if (job.length === 0) return { error: NOT_FOUND };

  const { error } = await supabase
    .from("delivery_orders")
    .update({ running_no: null })
    .eq("job_id", jobId)
    .eq("mof_id", mofId)
    .select("id");
  if (error) {
    console.error("Could not take the number off the DO", error);
    return {
      error:
        "The delivery was postponed, but its DO no. was not cancelled. Try again.",
    };
  }

  revalidateDo(mofId);
  return { error: null };
}

const nextNumberForm = z.object({
  nextNo: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Key in 4 digits, e.g. 5563.")
    .transform(Number),
});

/**
 * Sets the next DO running no. once, to continue from the last manual DO. The database refuses
 * a number that is not above every number used or cancelled.
 */
export async function setNextDoNumber(formData: FormData): Promise<DoResult> {
  const me = await requirePage("inst");
  if (!canSetNextDoNumber(me.jobRole)) {
    return {
      error: "Only the MD, Purchasing or HR & Accounts can set the next DO no.",
    };
  }
  const parsed = nextNumberForm.safeParse({
    nextNo: textField(formData, "nextNo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_next_do_number", {
    p_next_no: parsed.data.nextNo,
  });
  if (error) {
    // The database words these for her: "must be higher than the last number used (5560)".
    if (error.code === "23514") return { error: error.message };
    if (error.code === "42501") {
      return { error: "You cannot set the next DO no." };
    }
    console.error("Could not set the next DO no.", error);
    return { error: TRY_AGAIN };
  }

  revalidateDoLists();
  return { error: null };
}
