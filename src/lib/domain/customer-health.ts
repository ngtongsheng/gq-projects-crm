import { type CalendarDate, daysBetween } from "@/lib/format/date";

export type CustomerHealth = "new" | "active" | "quiet" | "no_activity";

export const CustomerHealthLabel: Record<CustomerHealth, string> = {
  new: "New",
  active: "Active",
  quiet: "Quiet",
  no_activity: "No activity",
};

const QUIET_AFTER_DAYS = 60;
const NO_ACTIVITY_AFTER_DAYS = 90;

/** How long since the customer's last completed activity. Null means nothing completed yet. */
export function customerHealth(
  lastCompletedActivityDate: CalendarDate | null,
  today: CalendarDate,
): CustomerHealth {
  if (lastCompletedActivityDate === null) return "new";
  const idleDays = daysBetween(lastCompletedActivityDate, today);
  if (idleDays > NO_ACTIVITY_AFTER_DAYS) return "no_activity";
  if (idleDays > QUIET_AFTER_DAYS) return "quiet";
  return "active";
}
