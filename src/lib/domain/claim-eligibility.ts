import type { JobRole } from "@/lib/auth/job-role";

type Claimant = { jobRole: JobRole; sells: boolean };

/** Files a travel claim (demo clCanClaimExp). The MD and HR & Accounts only check and approve. */
export const canFileClaim = (person: Claimant): boolean =>
  person.jobRole === "sales" ||
  person.jobRole === "bd" ||
  person.jobRole === "director" ||
  person.jobRole === "site" ||
  person.sells;

/** The MD and HR & Accounts see every claim and settle them (demo clCanManage). */
export const canManageClaims = (jobRole: JobRole): boolean =>
  jobRole === "md" || jobRole === "accounts";
