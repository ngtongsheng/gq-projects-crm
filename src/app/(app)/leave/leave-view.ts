import { type JobRole, JobRoleLabel } from "@/lib/auth/job-role";
import {
  canDecideLeave,
  type LeaveApplicant,
  type LeaveRequestParties,
  type LeaveViewer,
  leaveApprovers,
} from "@/lib/domain/leave-approval";
import {
  type LeaveBalance,
  type LeaveEntitlement,
  type LeavePolicy,
  type LeaveType,
  leaveBalance,
} from "@/lib/domain/leave-balance";
import { type CalendarDate, formatDate } from "@/lib/format/date";

/** One leave request as the page shows it. */
export type LeaveRow = LeaveRequestParties & {
  id: string;
  endsOn: CalendarDate;
  halfDay: "am" | "pm" | null;
  days: number;
  reason: string;
  slipFileName: string | null;
  originalGivenToHr: boolean;
  appliedOn: CalendarDate;
  decidedById: string | null;
  decidedOn: CalendarDate | null;
  decisionNote: string;
};

/** Someone whose balance can be worked out (the leave_people() list). */
export type LeavePerson = {
  id: string;
  name: string;
  jobRole: JobRole;
  joinedOn: CalendarDate | null;
  /** Their team lead, if a salesperson reports to one. */
  reportsTo: string | null;
};

/** What a balance needs besides the requests: the company default and each person's year override. */
export type LeaveSetup = {
  policy: LeavePolicy;
  /** Keyed by `${personId}:${year}`. */
  overrides: ReadonlyMap<string, LeaveEntitlement>;
};

const yearOf = (day: CalendarDate) => Number(day.slice(0, 4));

export const overrideKey = (personId: string, year: number) =>
  `${personId}:${year}`;

export function balanceFor(
  rows: readonly LeaveRow[],
  person: Pick<LeavePerson, "id" | "joinedOn">,
  year: number,
  setup: LeaveSetup,
): LeaveBalance | null {
  return leaveBalance({
    year,
    policy: setup.policy,
    joinedOn: person.joinedOn,
    override: setup.overrides.get(overrideKey(person.id, year)) ?? null,
    requests: rows
      .filter((row) => row.personId === person.id)
      .map((row) => ({
        leaveType: row.leaveType,
        startsOn: row.startsOn,
        status: row.status,
        days: row.days,
      })),
  });
}

/** The person's own leave that starts in the year, latest first. */
export const myLeave = (
  rows: readonly LeaveRow[],
  personId: string,
  year: number,
): LeaveRow[] =>
  rows
    .filter((row) => row.personId === personId && yearOf(row.startsOn) === year)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));

/** Leave waiting on this person now, oldest application first; any year. */
export const waitingForMe = (
  rows: readonly LeaveRow[],
  viewer: LeaveViewer,
): LeaveRow[] =>
  rows
    .filter((row) => canDecideLeave(row, viewer))
    .sort((a, b) => a.appliedOn.localeCompare(b.appliedOn));

/** Days left after this request comes out, or null when it takes nothing off a balance. */
export function balanceAfter(
  type: LeaveType,
  days: number,
  balance: LeaveBalance | null,
): number | null {
  if (!balance) return null;
  if (type === "annual" || type === "emergency") {
    return balance.annualBalance - days;
  }
  if (type === "mc") return balance.mcBalance - days;
  return null;
}

/** Other people with approved leave overlapping this request. */
export const alsoAway = (
  request: LeaveRow,
  rows: readonly LeaveRow[],
): string[] => [
  ...new Set(
    rows
      .filter(
        (other) =>
          other.id !== request.id &&
          other.status === "approved" &&
          other.startsOn <= request.endsOn &&
          other.endsOn >= request.startsOn,
      )
      .map((other) => other.personId),
  ),
];

/** "12 Jan 2027", "12 Jan 2027 (AM)" or "12 Jan – 14 Jan 2027". */
export function leaveDates(row: LeaveRow): string {
  if (row.startsOn === row.endsOn) {
    return `${formatDate(row.startsOn)}${row.halfDay ? ` (${row.halfDay.toUpperCase()})` : ""}`;
  }
  // formatDate ends in the four-digit year; the first date drops it when both share it.
  const from =
    yearOf(row.startsOn) === yearOf(row.endsOn)
      ? formatDate(row.startsOn).slice(0, -5)
      : formatDate(row.startsOn);
  return `${from} – ${formatDate(row.endsOn)}`;
}

export type TeamLeaveRow = {
  person: LeavePerson;
  balance: LeaveBalance | null;
  /** The next leave that is not rejected or cancelled and has not ended. */
  next: LeaveRow | null;
  /** MC and hospitalisation, open, with no slip yet. */
  slipsMissing: number;
};

/** One row per person for the Team leave table, by name. */
export function teamLeaveRows(
  people: readonly LeavePerson[],
  rows: readonly LeaveRow[],
  year: number,
  setup: LeaveSetup,
  today: CalendarDate,
): TeamLeaveRow[] {
  return [...people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((person) => {
      const theirs = rows.filter((row) => row.personId === person.id);
      const next =
        theirs
          .filter(
            (row) =>
              (row.status === "pending" || row.status === "approved") &&
              row.endsOn >= today,
          )
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
      return {
        person,
        balance: balanceFor(rows, person, year, setup),
        next,
        slipsMissing: theirs.filter(
          (row) =>
            (row.leaveType === "mc" || row.leaveType === "hospitalisation") &&
            !row.hasSlip &&
            (row.status === "pending" || row.status === "approved") &&
            yearOf(row.startsOn) === year,
        ).length,
      };
    });
}

/** Who approves this person's leave, in the demo's "A or B" form; job roles by title, a team lead by name. */
export function approverLine(
  applicant: LeaveApplicant,
  nameOf: (personId: string) => string,
): string {
  return leaveApprovers(applicant)
    .map((approver) =>
      "approverId" in approver
        ? nameOf(approver.approverId)
        : approver.approverRole === "md"
          ? JobRoleLabel.md
          : JobRoleLabel.director,
    )
    .join(" or ");
}
