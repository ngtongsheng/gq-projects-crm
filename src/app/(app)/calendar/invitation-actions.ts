"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { ActivityStatus } from "../activities/schemas";

export type InvitationResult = { error: string | null };

const fail = (error: string): InvitationResult => ({ error });

const Answer = z.enum(["accepted", "declined"]);
export type InvitationAnswer = z.infer<typeof Answer>;

const activityIdSchema = z.uuid();
const profileIdsSchema = z.array(z.uuid()).min(1);

const activityRow = z.object({ status: ActivityStatus });

/**
 * The signed-in person accepts or declines their own invitation. The person is never an
 * argument, so nobody can answer for a colleague; the database refuses it as well.
 */
export async function answerInvitation(
  activityId: string,
  answer: InvitationAnswer,
): Promise<InvitationResult> {
  const me = await requirePage("cal");
  const parsedId = activityIdSchema.safeParse(activityId);
  const parsedAnswer = Answer.safeParse(answer);
  if (!parsedId.success || !parsedAnswer.success) {
    return fail("Choose accept or can't go.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_invitees")
    .update({ status: parsedAnswer.data })
    .eq("activity_id", parsedId.data)
    .eq("profile_id", me.id)
    .select("activity_id");
  if (error) {
    console.error("Could not answer invitation", error);
    return fail("Could not save your answer. Try again.");
  }
  if (data.length === 0) {
    return fail("You have no invitation to this activity.");
  }

  revalidatePath("/calendar");
  return { error: null };
}

/**
 * Invites colleagues to an activity the signed-in person may edit (the database decides).
 * They answer later; on a visit already recorded as done they count as having gone.
 */
export async function inviteColleagues(
  activityId: string,
  profileIds: string[],
): Promise<InvitationResult> {
  await requirePage("cust", "cal");
  const parsedId = activityIdSchema.safeParse(activityId);
  const parsedIds = profileIdsSchema.safeParse(profileIds);
  if (!parsedId.success || !parsedIds.success) {
    return fail("Choose who to invite.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("status")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error) {
    console.error("Could not load activity", error);
    return fail("Could not send the invitations. Try again.");
  }
  if (!data) return fail("Could not find that activity. Reload the page.");
  const status =
    activityRow.parse(data).status === "completed" ? "accepted" : "pending";

  const { error: inviteError } = await supabase
    .from("activity_invitees")
    .insert(
      [...new Set(parsedIds.data)].map((profileId) => ({
        activity_id: parsedId.data,
        profile_id: profileId,
        status,
      })),
    );
  if (inviteError) {
    console.error("Could not invite colleagues", inviteError);
    return fail("Could not send the invitations. Try again.");
  }

  revalidatePath("/calendar");
  return { error: null };
}
