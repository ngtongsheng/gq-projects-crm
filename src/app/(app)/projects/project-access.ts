import type { JobRole } from "@/lib/auth/job-role";

// Mirrors the projects policies in the projects migration; RLS is the real gate.
const isOwnerManager = (jobRole: JobRole) =>
  jobRole === "md" || jobRole === "director";

const isSalesperson = (jobRole: JobRole) =>
  jobRole === "bd" || jobRole === "sales";

/** The MD and Sales Director register for anyone; a salesperson for customers they own. */
export const canCreateProject = (
  jobRole: JobRole,
  ownsCustomer: boolean,
): boolean =>
  isOwnerManager(jobRole) || (isSalesperson(jobRole) && ownsCustomer);

/** The person in charge, the supporting salesperson, or the MD / Sales Director. HR & Accounts only reads. */
export const canEditProject = (
  jobRole: JobRole,
  isPicOrSupport: boolean,
): boolean =>
  isOwnerManager(jobRole) || (isSalesperson(jobRole) && isPicOrSupport);

/** Who looks after a project is the MD's or Sales Director's call; a salesperson is always the PIC of their own. */
export const canChoosePic = isOwnerManager;

/** BD, Sales and Site read only the projects they are on (projects read policy). */
export const readsOwnProjectsOnly = (jobRole: JobRole): boolean =>
  isSalesperson(jobRole) || jobRole === "site";
