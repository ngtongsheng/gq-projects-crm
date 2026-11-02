import { isManager, type JobRole } from "@/lib/auth/job-role";

// Values mirror the check constraints in the site_work migration.
export const SITE_ACTIVITIES = [
  "measurement",
  "inspection",
  "installation",
  "handover",
  "shooting",
  "touch_up",
  "delivery",
  "others",
] as const;
export type SiteActivity = (typeof SITE_ACTIVITIES)[number];

export const SITE_ACTIVITY_LABEL: Record<SiteActivity, string> = {
  measurement: "Measurement",
  inspection: "Inspection",
  installation: "Installation",
  handover: "Handover",
  shooting: "Shooting",
  touch_up: "Touch Up",
  delivery: "Delivery",
  others: "Others",
};

export const FOLLOW_UP_OWNERS = [
  "salesperson",
  "purchasing",
  "installation_team",
  "site_supervisor",
  "accounts",
  "client",
] as const;
export type FollowUpOwner = (typeof FOLLOW_UP_OWNERS)[number];

export const FOLLOW_UP_OWNER_LABEL: Record<FollowUpOwner, string> = {
  salesperson: "Salesperson",
  purchasing: "Purchasing",
  installation_team: "Installation team",
  site_supervisor: "Site supervisor",
  accounts: "Accounts",
  client: "Client",
};

/**
 * Who may tick a follow-up done (SQL: public.can_close_follow_up). Managers close any; the
 * installation team and the client have no login, so their actions are chased by the site
 * supervisor.
 */
export function canCloseFollowUp(
  jobRole: JobRole,
  owner: FollowUpOwner,
): boolean {
  if (isManager(jobRole)) return true;
  switch (owner) {
    case "salesperson":
      return jobRole === "sales" || jobRole === "bd";
    case "purchasing":
      return jobRole === "support";
    case "accounts":
      return false;
    default:
      return jobRole === "site";
  }
}

/** Open and past its due date; a follow-up with no due date is never overdue. */
export const isFollowUpOverdue = (
  followUp: { dueOn: string | null; done: boolean },
  today: string,
): boolean =>
  !followUp.done && followUp.dueOn !== null && followUp.dueOn < today;
