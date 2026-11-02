import { type CalendarDate, daysBetween, todayMyt } from "@/lib/format/date";

export type FlaggableProject = {
  /** True while the deal is still being chased (lead to negotiation). */
  open: boolean;
  nextActionDate: CalendarDate | null;
  /** ISO timestamp of the last change to the project. */
  updatedAt: string;
};

export type ProjectFlags = { overdue: boolean; stale: boolean };

const STALE_AFTER_DAYS = 14;

/** Overdue: the next action date has passed. Stale: untouched for more than 14 days. Closed stages are never flagged. */
export function projectFlags(
  project: FlaggableProject,
  today: CalendarDate,
): ProjectFlags {
  if (!project.open) return { overdue: false, stale: false };
  const overdue =
    project.nextActionDate !== null &&
    daysBetween(project.nextActionDate, today) > 0;
  const stale =
    daysBetween(todayMyt(new Date(project.updatedAt)), today) >
    STALE_AFTER_DAYS;
  return { overdue, stale };
}
