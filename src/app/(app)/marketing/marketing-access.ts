import type { JobRole } from "@/lib/auth/job-role";

/** Adds, changes and deletes marketing records (SQL: public.edits_marketing()). HR & Accounts only reads. */
export const editsMarketing = (jobRole: JobRole) =>
  ["md", "ssup", "support", "marketing"].includes(jobRole);
