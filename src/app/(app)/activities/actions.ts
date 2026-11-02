"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { createClient } from "@/lib/supabase/server";
import {
  canEditActivity,
  canLogActivity,
  canMoveActivity,
} from "./activity-access";
import {
  ActivityStatus,
  activityFormSchema,
  activityIdSchema,
} from "./schemas";

export type ActivityResult = { error: string | null };

const fail = (error: string): ActivityResult => ({ error });

const existingActivityRow = z.object({
  owner_id: z.string(),
  status: ActivityStatus,
  starts_at: z.string(),
});

const textField = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Looks up who owns an activity and where it stands; null when it is gone. */
async function findActivity(activityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("owner_id, status, starts_at")
    .eq("id", activityId)
    .maybeSingle();
  if (error) {
    console.error("Could not load activity", error);
    throw new Error("Could not load the activity.");
  }
  return data ? existingActivityRow.parse(data) : null;
}

type Change = { ok: false; error: string } | { ok: true; startsAt: string };

/** Everything that must hold before an existing activity moves to `to`. */
async function checkChange(
  me: { id: string; jobRole: JobRole },
  activityId: string,
  to: ActivityStatus,
): Promise<Change> {
  if (!activityIdSchema.safeParse(activityId).success) {
    return {
      ok: false,
      error: "Could not find that activity. Reload the page.",
    };
  }
  const existing = await findActivity(activityId);
  if (!existing) {
    return {
      ok: false,
      error: "Could not find that activity. Reload the page.",
    };
  }
  if (!canEditActivity(me.jobRole, existing.owner_id === me.id)) {
    return {
      ok: false,
      error: "Only the person who owns this activity can change it.",
    };
  }
  if (!canMoveActivity(existing.status, to)) {
    return {
      ok: false,
      error: "A completed or cancelled activity can't be reopened.",
    };
  }
  return { ok: true, startsAt: existing.starts_at };
}

/** Logs or plans an activity, or changes one when the form carries an activityId. */
export async function saveActivity(
  formData: FormData,
): Promise<ActivityResult> {
  const me = await requireSection("customers");
  if (!canLogActivity(me.jobRole)) {
    return fail("Your role can view activities but not log them.");
  }

  const parsed = activityFormSchema.safeParse({
    contactId: textField(formData, "contactId"),
    type: textField(formData, "type"),
    purpose: textField(formData, "purpose"),
    outcome: textField(formData, "outcome"),
    startsAt: textField(formData, "startsAt"),
    status: textField(formData, "status") || "planned",
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const form = parsed.data;
  const activityId = textField(formData, "activityId") || null;
  const supabase = await createClient();

  if (!activityId) {
    const { error } = await supabase.from("activities").insert({
      contact_id: form.contactId,
      owner_id: me.id,
      type: form.type,
      purpose: form.purpose,
      outcome: form.outcome,
      starts_at: form.startsAt.toISOString(),
      status: form.status,
    });
    if (error) {
      console.error("Could not save activity", error);
      return fail("Could not save the activity. Try again.");
    }
  } else {
    const checked = await checkChange(me, activityId, form.status);
    if (!checked.ok) return fail(checked.error);
    const { data, error } = await supabase
      .from("activities")
      .update({
        type: form.type,
        purpose: form.purpose,
        outcome: form.outcome,
        starts_at: form.startsAt.toISOString(),
        status: form.status,
      })
      .eq("id", activityId)
      .select("id");
    if (error) {
      console.error("Could not update activity", error);
      return fail("Could not save the activity. Try again.");
    }
    if (data.length === 0) {
      return fail("Only the person who owns this activity can change it.");
    }
  }

  revalidatePath("/customers", "layout");
  return { error: null };
}

/** Quick action on a planned activity: mark it completed or cancelled. */
export async function setActivityStatus(
  activityId: string,
  status: ActivityStatus,
): Promise<ActivityResult> {
  const me = await requireSection("customers");
  const target = ActivityStatus.safeParse(status);
  if (!target.success) return fail("Choose completed or cancelled.");

  const checked = await checkChange(me, activityId, target.data);
  if (!checked.ok) return fail(checked.error);
  if (target.data === "completed" && new Date(checked.startsAt) > new Date()) {
    return fail("This activity hasn't started yet. Change its time first.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .update({ status: target.data })
    .eq("id", activityId)
    .select("id");
  if (error) {
    console.error("Could not update activity status", error);
    return fail("Could not save the change. Try again.");
  }
  if (data.length === 0) {
    return fail("Only the person who owns this activity can change it.");
  }

  revalidatePath("/customers", "layout");
  return { error: null };
}
