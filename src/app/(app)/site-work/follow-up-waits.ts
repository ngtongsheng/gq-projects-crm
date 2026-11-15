import { z } from "zod";
import type { FollowUpWait } from "@/lib/domain/follow-up-snooze";

/** Embed this in a `site_follow_ups` select to get each follow-up's "still waiting" entries. */
export const WAITS_SELECT =
  "site_follow_up_waits(note, snoozed_until, created_at)";

export const waitRows = z.array(
  z.object({
    note: z.string(),
    snoozed_until: z.iso.date(),
    created_at: z.string(),
  }),
);

export const toWaits = (
  rows: z.infer<typeof waitRows>,
): readonly FollowUpWait[] =>
  rows.map((row) => ({
    note: row.note,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
  }));
