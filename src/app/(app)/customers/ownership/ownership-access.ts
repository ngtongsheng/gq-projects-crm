import type { JobRole } from "@/lib/auth/job-role";

// Mirrors the ownership_requests policies and decide_ownership_request();
// RLS and the database function are the real gate.

/** Salespeople ask for customers they do not already own. */
export const canRequestOwnership = (jobRole: JobRole, isOwner: boolean) =>
  (jobRole === "sales" || jobRole === "bd") && !isOwner;

export const canDecideOwnership = (jobRole: JobRole) =>
  jobRole === "md" || jobRole === "director";

/** Sidebar entry: deciders review the queue, salespeople follow their own requests. */
export const canOpenOwnershipRequests = (jobRole: JobRole) =>
  canDecideOwnership(jobRole) || jobRole === "sales" || jobRole === "bd";
