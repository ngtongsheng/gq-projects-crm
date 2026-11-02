import type { StatusTone } from "@/components/app/status-badge";
import type { ActivityStatus } from "./schemas";

/** Green completed, blue planned, grey cancelled: the same colours on the customer page and the calendar. */
export const activityStatusTone: Record<ActivityStatus, StatusTone> = {
  planned: "info",
  completed: "good",
  cancelled: "neutral",
};
