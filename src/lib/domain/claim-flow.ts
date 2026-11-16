import type { JobRole } from "@/lib/auth/job-role";
import { addDays, type CalendarDate, formatMonth } from "@/lib/format/date";
import { claimPeriod } from "./monthly-claim";
import type { ReportKind } from "./report-stats";

// Values mirror the status check on monthly_claims.
export const CLAIM_STATUSES = [
  "draft",
  "submitted",
  "checked",
  "returned",
  "approved",
  "paid",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** The moves in the flow (D1). */
export const CLAIM_STEPS = [
  "submit",
  "check",
  "approve",
  "return",
  "pay",
] as const;
export type ClaimStep = (typeof CLAIM_STEPS)[number];

export const STATUS_AFTER: Record<ClaimStep, ClaimStatus> = {
  submit: "submitted",
  check: "checked",
  approve: "approved",
  return: "returned",
  pay: "paid",
};

export type ClaimViewer = { id: string; jobRole: JobRole };
export type FlowClaim = { profileId: string; status: ClaimStatus };

const WITH_CHECKERS: readonly ClaimStatus[] = ["submitted", "checked"];

/**
 * Who may take a step (D1, demo vClaims). Nobody moves their own claim past submitted; HR &
 * Accounts checks and pays; HR & Accounts or the MD approves or returns. The database
 * (guard_monthly_claim_write) checks the same rules again, apart from paying, which the demo
 * leaves to HR & Accounts alone.
 */
export function canTakeStep(
  step: ClaimStep,
  viewer: ClaimViewer,
  claim: FlowClaim,
): boolean {
  const own = claim.profileId === viewer.id;
  if (step === "submit") {
    return own && (claim.status === "draft" || claim.status === "returned");
  }
  if (own) return false;
  switch (step) {
    case "check":
      return viewer.jobRole === "accounts" && claim.status === "submitted";
    case "approve":
    case "return":
      return (
        (viewer.jobRole === "md" || viewer.jobRole === "accounts") &&
        WITH_CHECKERS.includes(claim.status)
      );
    case "pay":
      return viewer.jobRole === "accounts" && claim.status === "approved";
  }
}

/** The MD and HR & Accounts see every claim and settle them (demo clCanManage). */
export const canManageClaims = (jobRole: JobRole): boolean =>
  jobRole === "md" || jobRole === "accounts";

const ADJUSTABLE: readonly ClaimStatus[] = ["submitted", "checked"];

/**
 * Who may change amounts, the remark, the OT amount or tick the original receipts: the MD or
 * HR & Accounts on someone else's claim while it is with them. Not once approved, because the
 * commission is paid out at approval (the demo also lets amounts change then).
 */
export const canAdjustClaim = (
  viewer: ClaimViewer,
  claim: FlowClaim,
): boolean =>
  canManageClaims(viewer.jobRole) &&
  claim.profileId !== viewer.id &&
  ADJUSTABLE.includes(claim.status);

/** The steps the viewer may take on this claim, in flow order. */
export const stepsFor = (viewer: ClaimViewer, claim: FlowClaim): ClaimStep[] =>
  CLAIM_STEPS.filter((step) => canTakeStep(step, viewer, claim));

/**
 * HR & Accounts holds the signed form and the original receipts before checking or approving
 * (demo clChk, clApp). The MD approving does not need them.
 */
export function receiptsBlock(input: {
  step: ClaimStep;
  jobRole: JobRole;
  receiptCount: number;
  originalReceiptsReceived: boolean;
}): string | null {
  const needsOriginals =
    input.step === "check" ||
    (input.step === "approve" && input.jobRole === "accounts");
  if (
    needsOriginals &&
    input.receiptCount > 0 &&
    !input.originalReceiptsReceived
  ) {
    return "Tick 'Original receipts received' first. The signed claim form and receipts must be with you.";
  }
  return null;
}

/**
 * A flagged claim (nothing logged that day, over a standard) is checked or approved only once
 * the checker has written what they found (demo clChk, clApp). The remark is the person's to read.
 */
export function flagRemarkBlock(input: {
  step: ClaimStep;
  flagCount: number;
  remark: string;
}): string | null {
  const decides = input.step === "check" || input.step === "approve";
  if (!decides || input.flagCount === 0 || input.remark.trim() !== "")
    return null;
  return input.step === "check"
    ? "Some items are not in the itinerary or are over the standard. Write in the remark what you found (justified or adjusted) so the MD can decide."
    : "Some items are not in the itinerary or are over the standard. Write in the remark what you found before approving.";
}

// Values mirror the status check on monthly_reports.
export type ReportStatus = "draft" | "submitted" | "reviewed" | "approved";

/** The month before a claim month, whose report the submit gate looks at. */
export const lastMonthOf = (month: CalendarDate): CalendarDate =>
  `${addDays(month, -1).slice(0, 8)}01`;

const monthEnd = (month: CalendarDate): CalendarDate =>
  addDays(`${addDays(month, 31).slice(0, 8)}01`, -1);

/**
 * D6 needRep: a claim is submitted only once last month's monthly report is. People who file
 * no report, and people who had not joined by the end of last month, are not held.
 */
export function submitReportBlock(input: {
  needReport: boolean;
  claimMonth: CalendarDate;
  reportKind: ReportKind | null;
  joinedOn: CalendarDate | null;
  lastMonthReport: ReportStatus | null;
}): string | null {
  const lastMonth = lastMonthOf(input.claimMonth);
  if (
    !input.needReport ||
    input.reportKind === null ||
    (input.joinedOn !== null && input.joinedOn > monthEnd(lastMonth)) ||
    (input.lastMonthReport !== null && input.lastMonthReport !== "draft")
  ) {
    return null;
  }
  return `Please submit your ${formatMonth(lastMonth)} monthly report first.`;
}

/**
 * D6 clRepOk: payment waits until the person's report for the claim month is reviewed and
 * given the MD's final approval (loop 14 two-step review). People who file no report are not held.
 */
export function payReportBlock(input: {
  claimMonth: CalendarDate;
  reportKind: ReportKind | null;
  claimMonthReport: ReportStatus | null;
}): string | null {
  if (input.reportKind === null || input.claimMonthReport === "approved") {
    return null;
  }
  return `Hold payment until this person's ${formatMonth(input.claimMonth)} monthly report is approved by the MD.`;
}

/** Submitted after the claim month's cut-off day: it goes into next month's payment (demo clSub). */
export const submittedAfterCutOff = (
  claimMonth: CalendarDate,
  cutOffDay: number,
  today: CalendarDate,
): boolean => today > claimPeriod(claimMonth, cutOffDay).to;
