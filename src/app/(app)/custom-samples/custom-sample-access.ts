import type { JobRole } from "@/lib/auth/job-role";

type Person = { jobRole: JobRole; sells: boolean };

/** Records, edits and deletes samples (SQL: public.keeps_custom_samples()). */
export const keepsCustomSamples = (jobRole: JobRole) =>
  ["md", "designer", "support", "ssup", "marketing", "director"].includes(
    jobRole,
  );

/** Borrows for themselves (SQL: public.sells_custom_samples()). HR & Accounts and Site Supervisors never do. */
export const isCustomSampleSeller = ({ jobRole, sells }: Person) =>
  ["sales", "bd", "director"].includes(jobRole) ||
  (sells && jobRole !== "accounts" && jobRole !== "site");

/** A seller, or the MD for a salesperson (SQL: the "sellers and the md borrow" policy). */
export const canBorrowCustomSample = (person: Person) =>
  isCustomSampleSeller(person) || person.jobRole === "md";
