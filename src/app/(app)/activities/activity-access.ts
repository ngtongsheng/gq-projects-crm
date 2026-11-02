import { isReadOnly, type JobRole } from "@/lib/auth/job-role";

import type { ActivityStatus } from "./schemas";

// Mirrors the activities policies in the activities migration; RLS is the real gate.
const isOwnerManager = (jobRole: JobRole) =>
  jobRole === "md" || jobRole === "director";

/** Everyone except HR & Accounts logs activities, always under their own name. */
export const canLogActivity = (jobRole: JobRole) => !isReadOnly(jobRole);

/** The activity's owner, or the MD / Sales Director. */
export const canEditActivity = (jobRole: JobRole, isActivityOwner: boolean) =>
  isOwnerManager(jobRole) || (isActivityOwner && canLogActivity(jobRole));

const NEXT: Record<ActivityStatus, readonly ActivityStatus[]> = {
  planned: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** A planned activity is completed or cancelled; those two are final. Staying put is not a change. */
export const canMoveActivity = (from: ActivityStatus, to: ActivityStatus) =>
  from === to || NEXT[from].includes(to);
