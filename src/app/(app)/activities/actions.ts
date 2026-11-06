"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { textField } from "@/lib/form/form-fields";
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

type Change = { ok: false; error: string } | { ok: true; startsAt: string };

const gone = {
  ok: false,
  error: "Could not find that activity. Reload the page.",
} as const;

/** Everything that must hold before an existing activity moves to `to`. */
async function checkChange(
  me: { id: string; jobRole: JobRole },
  activityId: string,
  to: ActivityStatus,
): Promise<Change> {
  if (!activityIdSchema.safeParse(activityId).success) return gone;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("owner_id, status, starts_at")
    .eq("id", activityId)
    .maybeSingle();
  if (error) {
    console.error("Could not load activity", error);
    return { ok: false, error: "Could not save the activity. Try again." };
  }
  if (!data) return gone;

  const existing = existingActivityRow.parse(data);
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

const attendeeIdsSchema = z
  .array(z.uuid({ error: "Choose who to invite from the list." }))
  .max(8, "Invite at most 8 colleagues.")
  .transform((ids) => [...new Set(ids)]);

const INVITE_PROBLEM =
  "The activity was saved, but the invitations could not be saved. Open it to try again.";

/**
 * Makes `ids` the people invited to the activity: the ones left out are uninvited, new ones are
 * invited. Returns a message when it fails, null when it worked. The database refuses anyone who is
 * not a salesperson or director, and the owner themselves.
 */
async function setAttendees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  activityId: string,
  ids: readonly string[],
): Promise<string | null> {
  const removed = await supabase
    .from("activity_attendees")
    .delete()
    .eq("activity_id", activityId);
  if (removed.error) {
    console.error("Could not clear the invitations", removed.error);
    return INVITE_PROBLEM;
  }
  if (ids.length === 0) return null;
  const added = await supabase.from("activity_attendees").insert(
    ids.map((profileId) => ({
      activity_id: activityId,
      profile_id: profileId,
    })),
  );
  if (added.error) {
    console.error("Could not save the invitations", added.error);
    return INVITE_PROBLEM;
  }
  return null;
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

  // Earlier calls stay and can be edited; a new one is not logged.
  if (!activityId && form.type === "call") {
    return fail(
      "Calls are no longer logged. Choose a visit, site visit, walk-in or online meeting.",
    );
  }
  // Who is invited along. Left untouched when the form never showed the list.
  const invitesShown = formData.get("invitesShown") === "yes";
  const attendees = attendeeIdsSchema.safeParse(formData.getAll("attendeeIds"));
  if (!attendees.success) {
    return fail(attendees.error.issues[0]?.message ?? "Check who is invited.");
  }
  let savedId = activityId;

  if (!activityId) {
    const { data, error } = await supabase
      .from("activities")
      .insert({
        contact_id: form.contactId,
        owner_id: me.id,
        type: form.type,
        purpose: form.purpose,
        outcome: form.outcome,
        starts_at: form.startsAt.toISOString(),
        status: form.status,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Could not save activity", error);
      return fail("Could not save the activity. Try again.");
    }
    savedId = z.object({ id: z.string() }).parse(data).id;
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

  if (savedId && invitesShown) {
    const invited = await setAttendees(supabase, savedId, attendees.data);
    if (invited) {
      revalidatePath("/customers", "layout");
      revalidatePath("/calendar");
      return fail(invited);
    }
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/calendar");
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
  revalidatePath("/calendar");
  return { error: null };
}
