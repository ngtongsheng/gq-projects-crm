"use server";

import { z } from "zod";
import { requireSection } from "@/lib/auth/require-section";
import { createClient } from "@/lib/supabase/server";

export type InviteOptions = {
  /** Everyone who can be invited, except the person asking. */
  colleagues: { id: string; name: string }[];
  /** Who is already invited to the activity being edited. */
  invited: string[];
};

const colleagueRows = z.array(
  z.object({ id: z.uuid(), full_name: z.string().nullable() }),
);
const attendeeRows = z.array(z.object({ profile_id: z.string() }));

/**
 * The colleagues who can be invited to an activity, and who already is when `activityId` is given.
 * Salespeople and directors only; the person logging it is left out.
 */
export async function loadInviteOptions(
  activityId: string | null,
): Promise<InviteOptions> {
  const me = await requireSection("customers");
  const supabase = await createClient();
  const [colleagues, attendees] = await Promise.all([
    supabase.rpc("sales_colleagues"),
    activityId && z.uuid().safeParse(activityId).success
      ? supabase
          .from("activity_attendees")
          .select("profile_id")
          .eq("activity_id", activityId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (colleagues.error) {
    throw new Error(`Could not load colleagues: ${colleagues.error.message}`);
  }
  if (attendees.error) {
    throw new Error(`Could not load invitations: ${attendees.error.message}`);
  }
  return {
    colleagues: colleagueRows
      .parse(colleagues.data)
      .filter((row) => row.id !== me.id)
      .map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed" })),
    invited: attendeeRows.parse(attendees.data).map((row) => row.profile_id),
  };
}
