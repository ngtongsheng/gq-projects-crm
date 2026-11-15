import type { CalendarDate } from "@/lib/format/date";
import { addWorkdays } from "./task-due-date";
import type { WorkCalendar } from "./workdays";

/** How long "still waiting" can hold a follow-up back, in working days (demo: 1, 2 or 5). */
export const SNOOZE_DAYS = [1, 2, 5] as const;
export type SnoozeDays = (typeof SNOOZE_DAYS)[number];

/** The day to chase again: working days only, so Sundays and public holidays never count. */
export const snoozeUntil = (
  today: CalendarDate,
  days: SnoozeDays,
  calendar: WorkCalendar,
): CalendarDate => addWorkdays(today, days, calendar);

export type FollowUpWait = {
  note: string;
  snoozedUntil: CalendarDate;
  createdAt: string;
};

/** The latest "still waiting" entry is the follow-up's snooze; earlier ones are history. */
export function currentWait(
  waits: readonly FollowUpWait[],
): FollowUpWait | null {
  let latest: FollowUpWait | null = null;
  for (const wait of waits) {
    if (latest === null || wait.createdAt > latest.createdAt) latest = wait;
  }
  return latest;
}

/** Held back until the snooze day itself, when it comes up again. */
export const isSnoozed = (
  wait: Pick<FollowUpWait, "snoozedUntil"> | null,
  today: CalendarDate,
): boolean => wait !== null && wait.snoozedUntil > today;
