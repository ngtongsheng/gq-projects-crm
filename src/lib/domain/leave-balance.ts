import { addDays, type CalendarDate } from "@/lib/format/date";
import { isWorkday, type WorkCalendar } from "./workdays";

/** Balances start 1 Jan 2027; there are no leave records for 2026 (loop 15 D2). */
export const FIRST_LEAVE_YEAR = 2027;

// Values mirror the check constraints in the leave migration.
export const LEAVE_TYPES = [
  "annual",
  "mc",
  "emergency",
  "hospitalisation",
  "replacement",
  "compassionate",
  "maternity_paternity",
  "unpaid",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

/** The company default in app_settings (leave_annual_days, leave_mc_days, leave_prorate). */
export type LeavePolicy = {
  annualDays: number;
  mcDays: number;
  prorate: boolean;
};

/** One person's leave for one year; a leave_entitlements row overrides the default. */
export type LeaveEntitlement = {
  annualDays: number;
  carriedDays: number;
  mcDays: number;
};

export type LeaveRequestDays = {
  leaveType: LeaveType;
  startsOn: CalendarDate;
  status: LeaveStatus;
  days: number;
};

export type LeaveBalance = {
  entitlement: LeaveEntitlement;
  annualTaken: number;
  annualPending: number;
  annualBalance: number;
  mcTaken: number;
  mcPending: number;
  mcBalance: number;
};

// Only annual and emergency leave come out of annual leave (demo LV_TYPES).
const deductsAnnualLeave = (type: LeaveType): boolean =>
  type === "annual" || type === "emergency";

/**
 * Working days in a request (D5): the person's week minus public holidays; a half day is 0.5.
 * Mirrors prepare_leave_request in the leave migration, which stores the count.
 */
export function leaveDays(
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  halfDay: boolean,
  calendar: WorkCalendar,
): number {
  let count = 0;
  for (let day = startsOn; day <= endsOn; day = addDays(day, 1)) {
    if (isWorkday(day, calendar)) count++;
  }
  return halfDay ? count * 0.5 : count;
}

/**
 * The company default for a year. In the year someone joins, annual leave is prorated from
 * the join month (the join month counts in full), rounded down to the half day (demo entDefault).
 */
export function defaultEntitlement(
  policy: LeavePolicy,
  joinedOn: CalendarDate | null,
  year: number,
): LeaveEntitlement {
  const joinYear = joinedOn ? Number(joinedOn.slice(0, 4)) : null;
  if (policy.prorate && joinedOn && joinYear === year) {
    const months = 12 - Number(joinedOn.slice(5, 7)) + 1;
    const annualDays = Math.floor(((policy.annualDays * months) / 12) * 2) / 2;
    return { annualDays, carriedDays: 0, mcDays: policy.mcDays };
  }
  return {
    annualDays: policy.annualDays,
    carriedDays: 0,
    mcDays: policy.mcDays,
  };
}

const sumDays = (
  requests: readonly LeaveRequestDays[],
  status: LeaveStatus,
  counts: (type: LeaveType) => boolean,
): number =>
  requests
    .filter((r) => r.status === status && counts(r.leaveType))
    .reduce((total, r) => total + r.days, 0);

/**
 * Annual leave and MC balances for one year. Leave belongs to the year it starts in. Taken is
 * approved leave; pending is shown beside it and not deducted. Null before 2027 (D2).
 */
export function leaveBalance(input: {
  year: number;
  policy: LeavePolicy;
  joinedOn: CalendarDate | null;
  override: LeaveEntitlement | null;
  requests: readonly LeaveRequestDays[];
}): LeaveBalance | null {
  if (input.year < FIRST_LEAVE_YEAR) return null;
  const entitlement =
    input.override ??
    defaultEntitlement(input.policy, input.joinedOn, input.year);
  const inYear = input.requests.filter(
    (r) => Number(r.startsOn.slice(0, 4)) === input.year,
  );
  const isMc = (type: LeaveType) => type === "mc";
  const annualTaken = sumDays(inYear, "approved", deductsAnnualLeave);
  const mcTaken = sumDays(inYear, "approved", isMc);
  return {
    entitlement,
    annualTaken,
    annualPending: sumDays(inYear, "pending", deductsAnnualLeave),
    annualBalance:
      entitlement.annualDays + entitlement.carriedDays - annualTaken,
    mcTaken,
    mcPending: sumDays(inYear, "pending", isMc),
    mcBalance: entitlement.mcDays - mcTaken,
  };
}
