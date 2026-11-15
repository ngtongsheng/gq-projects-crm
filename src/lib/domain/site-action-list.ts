import {
  FOLLOW_UP_OWNERS,
  type FollowUpOwner,
  isFollowUpOverdue,
} from "./site-log";

/** The owner filter on Actions needed: everyone, or one group (demo: ACTION_BY). */
export const ACTION_GROUP_FILTERS = ["all", ...FOLLOW_UP_OWNERS] as const;
export type ActionGroupFilter = (typeof ACTION_GROUP_FILTERS)[number];

/** The asked-for filter, or everyone when the address holds anything else. */
export function parseActionGroup(
  value: string | string[] | undefined,
): ActionGroupFilter {
  return ACTION_GROUP_FILTERS.find((group) => group === value) ?? "all";
}

type OpenAction = { ownerGroup: FollowUpOwner };

/** How many open actions each filter would show, for the number beside it. */
export function openActionCounts(
  open: readonly OpenAction[],
): Record<ActionGroupFilter, number> {
  const counts = Object.fromEntries(
    ACTION_GROUP_FILTERS.map((group) => [group, 0]),
  ) as Record<ActionGroupFilter, number>;
  for (const action of open) {
    counts.all += 1;
    counts[action.ownerGroup] += 1;
  }
  return counts;
}

export const inActionGroup = (
  action: OpenAction,
  group: ActionGroupFilter,
): boolean => group === "all" || action.ownerGroup === group;

/** Soonest due first; an action with no due date waits at the end. */
export const byDueDate = (
  a: { dueOn: string | null },
  b: { dueOn: string | null },
): number => {
  if (a.dueOn === b.dueOn) return 0;
  if (a.dueOn === null) return 1;
  if (b.dueOn === null) return -1;
  return a.dueOn.localeCompare(b.dueOn);
};

export type ActionDueState = "overdue" | "due" | "no-date";

/** What the pill on an open action says. */
export function actionDueState(
  action: { dueOn: string | null },
  today: string,
): ActionDueState {
  if (action.dueOn === null) return "no-date";
  return isFollowUpOverdue({ dueOn: action.dueOn, done: false }, today)
    ? "overdue"
    : "due";
}
