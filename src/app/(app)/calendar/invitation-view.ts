import { z } from "zod";

// Values mirror the check constraint on activity_invitees.
export const InviteeStatus = z.enum(["pending", "accepted", "declined"]);
export type InviteeStatus = z.infer<typeof InviteeStatus>;

type Invitee = { profileId: string; name: string; status: InviteeStatus };

/** An invitation the viewer has not answered: someone else's activity, their own seat still pending. */
export function isAwaitingReply(
  ownerId: string,
  invitees: { profile_id: string; status: InviteeStatus }[],
  meId: string,
): boolean {
  return (
    ownerId !== meId &&
    invitees.some((i) => i.profile_id === meId && i.status === "pending")
  );
}

/**
 * The short line under an event, as in the demo: "with Arun" for a colleague who is going along,
 * otherwise "+ Mei ?" listing who was invited, a "?" marking those who have not replied yet.
 * Declined colleagues are left out. Empty when nobody is invited.
 */
export function invitationTag({
  ownerName,
  ownerIsMe,
  invitees,
  meId,
}: {
  ownerName: string;
  ownerIsMe: boolean;
  invitees: Invitee[];
  meId: string;
}): string | undefined {
  const going = invitees.filter((i) => i.status !== "declined");
  if (going.length === 0) return undefined;
  if (!ownerIsMe && going.some((i) => i.profileId === meId)) {
    return `with ${ownerName}`;
  }
  return `+ ${going.map((i) => (i.status === "pending" ? `${i.name} ?` : i.name)).join(", ")}`;
}
