import { isReadOnly, type JobRole } from "@/lib/auth/job-role";

// Mirrors the contacts policies in the customers migration; RLS is the real gate.
const isOwnerManager = (jobRole: JobRole) =>
  jobRole === "md" || jobRole === "director";

/** Everyone except HR & Accounts, who only read customers. */
export const canAddContact = (jobRole: JobRole) => !isReadOnly(jobRole);

export const canEditContact = (jobRole: JobRole, isOwner: boolean) =>
  isOwnerManager(jobRole) || (isOwner && !isReadOnly(jobRole));

/** Account type and passed-by are set by the MD or Sales Director; everyone else adds own-effort accounts. */
export const canSetAccountType = isOwnerManager;

/** Paste-from-sheet import sets owners and updates companies, which only these roles may. */
export const canImportCustomers = isOwnerManager;
