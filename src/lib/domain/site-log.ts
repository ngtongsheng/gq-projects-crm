import { isManager, type JobRole } from "@/lib/auth/job-role";
import { isSameMonth } from "@/lib/domain/calendar-grid";
import { isWorkday } from "@/lib/domain/workdays";
import { addDays, type CalendarDate, formatDate } from "@/lib/format/date";

// Values mirror the check constraint in the site_log_parity migration.
export const SITE_ACTIVITIES = [
  "measurement",
  "inspection",
  "installation",
  "handover",
  "shooting",
  "touch_up",
  "delivery",
  "stock_return",
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
  stock_return: "Stock return",
  others: "Others",
};

/** The installed % keyed in is below the last one for the same MOF: ask them to check again. */
export const isLowerThanLastInstalled = (
  installedPct: number,
  lastInstalledPct: number | null,
): boolean => lastInstalledPct !== null && installedPct < lastInstalledPct;

/** Where a log was: the MOF, or for a new site with no MOF yet, the typed-in site name. */
export type LoggedSite = {
  visitedOn: CalendarDate;
  mofId: string | null;
  siteName: string | null;
};

const siteKey = (log: Omit<LoggedSite, "visitedOn">) =>
  log.mofId ? `mof:${log.mofId}` : `site:${log.siteName?.toLowerCase()}`;

/**
 * Site visits in the month, the figure counted against the monthly visit target: one per site
 * per day, however many activities were logged there.
 */
export const countSiteVisits = (
  logs: readonly LoggedSite[],
  month: CalendarDate,
): number =>
  new Set(
    logs
      .filter((log) => isSameMonth(log.visitedOn, month))
      .map((log) => `${log.visitedOn}|${siteKey(log)}`),
  ).size;

/** Values mirror the check constraint on site_off; leave and MC live in the Leave module (D2). */
export const SITE_OFF_KINDS = ["office", "other"] as const;
export type SiteOffKind = (typeof SITE_OFF_KINDS)[number];

export const SITE_OFF_KIND_LABEL: Record<SiteOffKind, string> = {
  office: "Office",
  other: "Other",
};

/** Days away from site: office or other days, and approved leave or MC (loop 17 D2). */
export type AwayRange = { startsOn: CalendarDate; endsOn: CalendarDate };

export type SiteDayInput = {
  today: CalendarDate;
  holidays: ReadonlySet<CalendarDate>;
  away: readonly AwayRange[];
  /** No reminders for days before they joined. */
  joinedOn: CalendarDate | null;
};

// The reminders look back one week, as in the demo.
const LOOKBACK_DAYS = 7;

/** The past week's days a supervisor was due on site: Monday to Saturday, not a holiday, not away. */
function pastSiteDays(input: SiteDayInput): CalendarDate[] {
  const calendar = { week: "mon-sat" as const, holidays: input.holidays };
  const days: CalendarDate[] = [];
  for (let back = LOOKBACK_DAYS; back >= 1; back--) {
    const day = addDays(input.today, -back);
    if (input.joinedOn && day < input.joinedOn) continue;
    if (!isWorkday(day, calendar)) continue;
    if (input.away.some((off) => off.startsOn <= day && day <= off.endsOn)) {
      continue;
    }
    days.push(day);
  }
  return days;
}

/** The past week's site days with nothing logged, oldest first: the "not recorded yet" banner. */
export function missedLogDays(
  input: SiteDayInput & { loggedDays: readonly CalendarDate[] },
): CalendarDate[] {
  const logged = new Set(input.loggedDays);
  return pastSiteDays(input).filter((day) => !logged.has(day));
}

/** A job the calendar planned for the supervisor on a day. */
export type PlannedSiteJob = {
  day: CalendarDate;
  mofId: string | null;
  projectId: string | null;
  siteName: string | null;
};

/** A log as matched against the plan. */
export type LoggedSiteJob = LoggedSite & { projectId: string | null };

export const sameSite = (job: PlannedSiteJob, log: LoggedSiteJob): boolean => {
  if (job.mofId && log.mofId) return job.mofId === log.mofId;
  if (job.projectId && log.projectId) return job.projectId === log.projectId;
  return (
    job.siteName !== null &&
    log.siteName !== null &&
    job.siteName.toLowerCase() === log.siteName.toLowerCase()
  );
};

/**
 * Planned jobs from the past week's site days that have no log at that site on that day:
 * the "planned jobs not recorded" banner. Keeps the caller's order.
 */
export function plannedJobsNotRecorded<Job extends PlannedSiteJob>(
  input: SiteDayInput & {
    planned: readonly Job[];
    logs: readonly LoggedSiteJob[];
  },
): Job[] {
  const siteDays = new Set(pastSiteDays(input));
  return input.planned.filter(
    (job) =>
      siteDays.has(job.day) &&
      !input.logs.some(
        (log) => log.visitedOn === job.day && sameSite(job, log),
      ),
  );
}

/** Starts the message when a visit was saved but a step after it failed, so it must not be saved again. */
export const VISIT_SAVED_BUT = "The visit is saved, but";

export const STOCK_RETURN_WAYS = [
  "installer",
  "transport",
  "supervisor",
] as const;
export type StockReturnWay = (typeof STOCK_RETURN_WAYS)[number];

export const STOCK_RETURN_WAY_LABEL: Record<StockReturnWay, string> = {
  installer: "Installer brings back",
  transport: "Need transport, office to arrange (Lalamove / lorry)",
  supervisor: "I bring it back myself",
};

export type StockReturnMessage = {
  /** True when the stock went back today (a stock return); false when it is still on site. */
  sentBack: boolean;
  mofNo: string;
  siteName: string;
  items: readonly { qty: number; unit: string; item: string }[];
  way: StockReturnWay;
  supervisorName: string;
  on: CalendarDate;
};

/** The WhatsApp text the supervisor sends the office with a photo of the balance stock. */
export function stockReturnWhatsAppText(message: StockReturnMessage): string {
  return [
    `${message.sentBack ? "Stock return today" : "Balance stock to return"}: ${message.mofNo} ${message.siteName}`,
    ...message.items.map((line) => `• ${line.qty} ${line.unit} ${line.item}`),
    `How: ${STOCK_RETURN_WAY_LABEL[message.way]}`,
    `From: ${message.supervisorName}, ${formatDate(message.on)}`,
    "(Photo attached)",
    ...(message.sentBack
      ? ["Purchasing please record: back to supplier or keep at Best Link."]
      : []),
  ].join("\n");
}

/**
 * Opens WhatsApp with the text ready (loop 17 D4: nothing is sent by the app). With no office
 * number they pick the chat themselves.
 */
export const whatsAppLink = (mobile: string | null, text: string): string =>
  `https://wa.me/${mobile ?? ""}?text=${encodeURIComponent(text)}`;

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

/** Closing or snoozing: the owning group, a manager, or the person the follow-up was assigned to. */
export const canChaseFollowUp = (
  person: { id: string; jobRole: JobRole },
  followUp: { ownerGroup: FollowUpOwner; assigneeId: string | null },
): boolean =>
  canCloseFollowUp(person.jobRole, followUp.ownerGroup) ||
  followUp.assigneeId === person.id;

/** Open and past its due date; a follow-up with no due date is never overdue. */
export const isFollowUpOverdue = (
  followUp: { dueOn: string | null; done: boolean },
  today: string,
): boolean =>
  !followUp.done && followUp.dueOn !== null && followUp.dueOn < today;
