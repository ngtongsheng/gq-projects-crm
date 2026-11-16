import type { JobRole } from "@/lib/auth/job-role";

type Claimant = { jobRole: JobRole; sells: boolean };

/** Claims commission: sales and the Marketing Director, or a Site Supervisor who also sells (demo clCanClaimComm). */
export const canClaimCommission = (person: Claimant): boolean =>
  person.jobRole === "sales" || person.jobRole === "bd" || person.sells;

/** Files a monthly claim at all (demo clCanClaimExp). The MD and HR & Accounts only check and approve. */
export const canFileClaim = (person: Claimant): boolean =>
  person.jobRole === "sales" ||
  person.jobRole === "bd" ||
  person.jobRole === "director" ||
  person.jobRole === "site" ||
  person.sells;
