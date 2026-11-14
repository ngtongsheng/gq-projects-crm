import { z } from "zod";
import type { Role } from "./current-profile";

/** What someone does at GQ Projects. Separate from `role`, which only decides who manages people. */
export const JobRole = z.enum([
  "md",
  "director",
  "bd",
  "sales",
  "accounts",
  "site",
  "support",
  "ssup",
  "marketing",
  "designer",
]);
export type JobRole = z.infer<typeof JobRole>;

// The titles in the demo's People list.
export const JobRoleLabel: Record<JobRole, string> = {
  md: "Managing Director",
  director: "Sales Director",
  bd: "Marketing Director",
  sales: "Salesperson",
  accounts: "HR & Accounts",
  site: "Site Supervisor",
  ssup: "Sales support",
  support: "Purchasing",
  marketing: "Marketing Executive",
  designer: "Designer",
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

/** Leads a sales team, so others can report to them (SQL: the check_reports_to trigger). */
export const canLeadTeam = (jobRole: JobRole) =>
  has(jobRole, ["director", "bd"]);

/** Sees the whole team's work (SQL: public.is_manager()). */
export const isManager = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "accounts"]);

/** HR & Accounts sees everything but changes only payments and commission. */
export const isReadOnly = (jobRole: JobRole) => jobRole === "accounts";

/** Starts a costing of their own (SQL: the "quotes: sellers add their own" policy). */
export const canStartQuote = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "bd", "sales"]);

/** Approves or returns a costing below the minimum margin (SQL: guard_quote_revision_write). */
export const canApproveQuote = (jobRole: JobRole) =>
  has(jobRole, ["md", "director"]);

export const canEditRegister = (jobRole: JobRole) =>
  has(jobRole, ["md", "support", "accounts"]);

/** Installer POs and claims (SQL: the read policies on installer_pos and installer_claims). */
export const canSeeInstallerClaims = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "accounts", "support", "site"]);

export const canEditSite = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "site"]);

/** Schedules delivery, installation and measurement jobs and keys in DOs (SQL: the policies on jobs). */
export const canScheduleJobs = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "support"]);

/** Moves a job along; a Site Supervisor only for jobs assigned to them, which the database checks. */
export const canUpdateJobStatus = (jobRole: JobRole) =>
  canScheduleJobs(jobRole) || jobRole === "site";

/** Books a Site Supervisor (SQL: the insert policy on site_bookings). */
export const canBookSiteSupervisor = (jobRole: JobRole) =>
  has(jobRole, ["md", "director", "bd", "sales"]);

/** Only a Site Supervisor answers a booking, and only their own, which the database checks. */
export const canAnswerBookings = (jobRole: JobRole) => jobRole === "site";

/** Approves or rejects overtime (SQL: the update policy on ot_claims, which also bars deciding your own). */
export const canDecideOvertime = (jobRole: JobRole) =>
  has(jobRole, ["md", "director"]);

export const canEnterPayments = (jobRole: JobRole) =>
  has(jobRole, ["md", "accounts"]);

/** Records commission paid out (SQL: the insert and delete policies on commission_payouts). */
export const canPayOutCommission = (jobRole: JobRole) =>
  has(jobRole, ["md", "accounts"]);

export const canEditStock = (person: {
  jobRole: JobRole;
  arrangesStock: boolean;
}) =>
  person.arrangesStock || has(person.jobRole, ["md", "director", "support"]);

/** Asks for a stock hold (SQL: the insert policy on stock_reservations). */
export const canRequestStock = (person: {
  jobRole: JobRole;
  arrangesStock: boolean;
}) => canEditStock(person) || has(person.jobRole, ["bd", "sales"]);

/** Changes the commission rules and stock hold settings (SQL: the write policies on app_settings). */
export const canChangeSettings = (person: { role: Role; jobRole: JobRole }) =>
  person.role === "admin" || person.jobRole === "md";
