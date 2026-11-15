"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import {
  SNOOZE_DAYS,
  type SnoozeDays,
  snoozeUntil,
} from "@/lib/domain/follow-up-snooze";
import { canChaseFollowUp, FOLLOW_UP_OWNERS } from "@/lib/domain/site-log";
import { weekKindFor } from "@/lib/domain/workdays";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadWorkCalendar } from "@/lib/work-calendar";

export type StillWaitingResult =
  | { error: string; snoozedUntil: null }
  | { error: null; snoozedUntil: string };

const NOT_FOUND = "Could not find that follow-up. Reload the page.";
const NOT_CHASER = "Only the group that owns this follow-up can snooze it.";

const waitForm = z.object({
  mofId: z.uuid({ error: NOT_FOUND }).nullable(),
  followUpId: z.uuid({ error: NOT_FOUND }),
  ownerGroup: z.enum(FOLLOW_UP_OWNERS, NOT_FOUND),
  assigneeId: z.uuid({ error: NOT_FOUND }).nullable(),
  note: z
    .string()
    .trim()
    .min(1, "Say what you are waiting for.")
    .max(300, "Keep the note under 300 characters."),
  days: z.custom<SnoozeDays>(
    (value) => SNOOZE_DAYS.some((days) => days === value),
    "Choose how long to wait.",
  ),
});

/**
 * Logs "still waiting" on an open follow-up and holds it back for 1, 2 or 5 working days. The
 * snooze day is worked out here, so a stale phone clock or an edited form cannot shorten it.
 */
export async function snoozeFollowUp(input: {
  mofId: string | null;
  followUpId: string;
  ownerGroup: string;
  assigneeId: string | null;
  note: string;
  days: number;
}): Promise<StillWaitingResult> {
  const me = await requirePage("site");

  const parsed = waitForm.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details.",
      snoozedUntil: null,
    };
  }
  const wait = parsed.data;
  if (!canChaseFollowUp(me, wait))
    return { error: NOT_CHASER, snoozedUntil: null };

  const calendar = await loadWorkCalendar(weekKindFor(me.jobRole));
  const snoozedUntil = snoozeUntil(todayMyt(), wait.days, calendar);

  const supabase = await createClient();
  const { error } = await supabase.from("site_follow_up_waits").insert({
    follow_up_id: wait.followUpId,
    note: wait.note,
    snoozed_until: snoozedUntil,
  });
  if (error) {
    if (error.code === "42501")
      return { error: NOT_CHASER, snoozedUntil: null };
    if (error.code === "23503") return { error: NOT_FOUND, snoozedUntil: null };
    console.error("Could not save that the follow-up is still waiting", error);
    return { error: "Could not save. Try again.", snoozedUntil: null };
  }

  revalidatePath("/site-work");
  revalidatePath("/today");
  if (wait.mofId) revalidatePath(`/site-work/${wait.mofId}`);
  return { error: null, snoozedUntil };
}
