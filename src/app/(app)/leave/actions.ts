"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canCancelLeave, decideLeave } from "@/lib/domain/leave-approval";
import { LEAVE_TYPES } from "@/lib/domain/leave-balance";
import { textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { loadLeave } from "./leave-load";

export type LeaveResult = { error: string | null };
export type ApplyResult = { error: string } | { error: null; id: string };

const NOT_FOUND = "Could not find that leave. Reload the page.";
const CHANGED = "This leave has just changed. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

// Raised by prepare_leave_request in the leave migration; plain enough to show as they are.
const DATE_PROBLEMS = [
  "Those dates have no working days.",
  "There is already leave on these dates.",
];

const leaveId = z.uuid({ error: NOT_FOUND });

const applyForm = z
  .object({
    leaveType: z.enum(LEAVE_TYPES, "Choose the type of leave."),
    startsOn: z.iso.date("Choose the first day."),
    endsOn: z.iso.date("Choose the last day."),
    halfDay: z
      .enum(["", "am", "pm"], "Choose morning or afternoon again.")
      .transform((value) => (value === "" ? null : value)),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters."),
  })
  .refine((form) => form.endsOn >= form.startsOn, {
    message: "The last day is before the first day.",
    path: ["endsOn"],
  })
  .refine((form) => form.halfDay === null || form.startsOn === form.endsOn, {
    message: "A half day is one day only.",
    path: ["halfDay"],
  });

/**
 * Applies for the person's own leave. The database counts the working days and writes the
 * approval chain; the id comes back so an MC or hospitalisation slip can be added next.
 */
export async function applyForLeave(formData: FormData): Promise<ApplyResult> {
  const me = await requirePage("leave");
  const parsed = applyForm.safeParse({
    leaveType: textField(formData, "leaveType"),
    startsOn: textField(formData, "startsOn"),
    endsOn: textField(formData, "endsOn"),
    halfDay: textField(formData, "halfDay"),
    reason: textField(formData, "reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      leave_type: form.leaveType,
      starts_on: form.startsOn,
      ends_on: form.endsOn,
      half_day: form.halfDay,
      reason: form.reason,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23514" && DATE_PROBLEMS.includes(error.message)) {
      return { error: error.message };
    }
    if (error.code === "23514") {
      return { error: "Leave can be up to a year long. Check the dates." };
    }
    logServerError("Could not apply for leave", error, {
      profileId: me.id,
    });
    return { error: TRY_AGAIN };
  }
  revalidatePath("/leave");
  return { error: null, id: z.object({ id: z.uuid() }).parse(data).id };
}

/** The person cancels their own leave: while pending, or approved leave before it starts. */
export async function cancelLeave(id: string): Promise<LeaveResult> {
  const me = await requirePage("leave");
  const parsedId = leaveId.safeParse(id);
  if (!parsedId.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsedId.data);
  if (!leave) return { error: NOT_FOUND };
  if (!canCancelLeave(leave, me, todayMyt())) {
    return {
      error:
        leave.personId === me.id
          ? "Leave that has started or is closed cannot be cancelled."
          : "Only the person on leave cancels it.",
    };
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", leave.id)
    .eq("status", leave.status)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: CHANGED };
    logServerError("Could not cancel the leave", error, {
      profileId: me.id,
      recordId: leave.id,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: CHANGED };
  revalidatePath("/leave");
  return { error: null };
}

const decisionForm = z.object({
  id: leaveId,
  remark: z.string().trim().max(500, "Keep the remark under 500 characters."),
});

/**
 * Decides the step waiting on this person through decide_leave(), which walks the chain and
 * sets the status. The same rules are checked here first for a plain message.
 */
async function decide(
  approve: boolean,
  id: string,
  remark: string,
): Promise<LeaveResult> {
  const me = await requirePage("leave");
  const parsed = decisionForm.safeParse({ id, remark });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const leave = await loadLeave(supabase, parsed.data.id);
  if (!leave) return { error: NOT_FOUND };
  const check = decideLeave(leave, me, approve);
  if (check.error !== null) return { error: check.error };

  const { error } = await supabase.rpc("decide_leave", {
    leave_request: leave.id,
    approve,
    remark: parsed.data.remark,
  });
  if (error) {
    // Someone decided or the slip changed between the load and the call.
    if (error.code === "42501") return { error: CHANGED };
    logServerError("Could not decide the leave", error, {
      profileId: me.id,
      recordId: leave.id,
    });
    return { error: TRY_AGAIN };
  }
  revalidatePath("/leave");
  return { error: null };
}

export async function approveLeave(
  id: string,
  remark: string,
): Promise<LeaveResult> {
  return decide(true, id, remark);
}

export async function rejectLeave(
  id: string,
  remark: string,
): Promise<LeaveResult> {
  return decide(false, id, remark);
}
