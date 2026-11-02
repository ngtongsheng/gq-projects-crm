import { z } from "zod";

/** What someone does at GQ Projects. Separate from `role`, which only decides who manages people. */
export const JobRole = z.enum([
  "md",
  "director",
  "bd",
  "sales",
  "accounts",
  "site",
  "support",
]);
export type JobRole = z.infer<typeof JobRole>;

export const JobRoleLabel: Record<JobRole, string> = {
  md: "MD",
  director: "Sales Director",
  bd: "BD Director",
  sales: "Sales",
  accounts: "HR & Accounts",
  site: "Site Supervisor",
  support: "Purchasing",
};

/** Per-person commission exception, set on the person rather than keyed by name. */
export const CommissionMode = z.enum([
  "standard",
  "excluded",
  "flat_pass_down",
]);
export type CommissionMode = z.infer<typeof CommissionMode>;

export const CommissionModeLabel: Record<CommissionMode, string> = {
  standard: "Standard",
  excluded: "No commission",
  flat_pass_down: "Flat 1% on pass-down sales",
};

// Mirrors the SQL helpers in the job_roles migration; RLS is the real gate.
const has = (jobRole: JobRole, allowed: readonly JobRole[]) =>
  allowed.includes(jobRole);

/** Sees the whole team's work (SQL: public.is_manager()). */
export const isManager = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "accounts"]);

/** HR & Accounts sees everything but changes only payments and commission. */
export const isReadOnly = (jobRole: JobRole) => jobRole === "accounts";

export const canEditRegister = (jobRole: JobRole) =>
  has(jobRole, ["md", "support", "accounts"]);

/** Installer POs and claims (SQL: the read policies on installer_pos and installer_claims). */
export const canSeeInstallerClaims = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "accounts", "support", "site"]);

export const canEditSite = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "site"]);

export const canEnterPayments = (jobRole: JobRole) =>
  has(jobRole, ["md", "accounts"]);

export const canEditStock = (person: {
  jobRole: JobRole;
  arrangesStock: boolean;
}) =>
  person.arrangesStock || has(person.jobRole, ["md", "director", "support"]);
