import type { JobRole } from "@/lib/auth/job-role";
import type { CalendarDate } from "@/lib/format/date";
import type { LeaveStatus, LeaveType } from "./leave-balance";

// Mirrors the leave migration: add_leave_approval_steps writes the chain, decide_leave walks it,
// guard_leave_request_write checks cancelling, slips and the "original given to HR" tick.

export type LeaveApprover =
  | { approverId: string }
  | { approverRole: "md" | "director" };

export type LeaveDecision = "approved" | "rejected";

export type LeaveApprovalStep = LeaveApprover & {
  position: number;
  decision: LeaveDecision | null;
};

export type LeaveApplicant = {
  jobRole: JobRole;
  /** The active team lead a salesperson reports to, if any. */
  teamLeadId: string | null;
};

export type LeaveViewer = { id: string; jobRole: JobRole };

export type LeaveRequestParties = {
  personId: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  startsOn: CalendarDate;
  hasSlip: boolean;
  steps: readonly LeaveApprovalStep[];
};

/** MC and hospitalisation carry a slip, uploaded before the leave is approved. */
export const needsSlip = (type: LeaveType) =>
  type === "mc" || type === "hospitalisation";

/**
 * The approvers in order (loop 15 D4): a salesperson's team lead then the MD; Marketing Director
 * and Site Supervisor: Sales Director then MD; the MD: Sales Director; everyone else: MD. A
 * salesperson without a team lead goes straight to the MD.
 */
export function leaveApprovers(applicant: LeaveApplicant): LeaveApprover[] {
  if (applicant.jobRole === "sales" && applicant.teamLeadId) {
    return [{ approverId: applicant.teamLeadId }, { approverRole: "md" }];
  }
  if (applicant.jobRole === "bd" || applicant.jobRole === "site") {
    return [{ approverRole: "director" }, { approverRole: "md" }];
  }
  if (applicant.jobRole === "md") return [{ approverRole: "director" }];
  return [{ approverRole: "md" }];
}

/** The MD decides any step; HR & Accounts any step of an MC or hospitalisation. */
function mayDecideStep(
  step: LeaveApprovalStep,
  request: LeaveRequestParties,
  viewer: LeaveViewer,
): boolean {
  return (
    ("approverId" in step
      ? step.approverId === viewer.id
      : step.approverRole === viewer.jobRole) ||
    viewer.jobRole === "md" ||
    (needsSlip(request.leaveType) && viewer.jobRole === "accounts")
  );
}

/** The step waiting for a decision, or null once every step is decided. */
export const waitingStep = (
  request: Pick<LeaveRequestParties, "steps">,
): LeaveApprovalStep | null =>
  [...request.steps]
    .sort((a, b) => a.position - b.position)
    .find((step) => step.decision === null) ?? null;

/** Whether this person gets the approve and reject buttons now. */
export function canDecideLeave(
  request: LeaveRequestParties,
  viewer: LeaveViewer,
): boolean {
  if (request.status !== "pending" || request.personId === viewer.id) {
    return false;
  }
  const step = waitingStep(request);
  return step !== null && mayDecideStep(step, request, viewer);
}

export type LeaveDecisionResult =
  | { error: string }
  | { error: null; steps: LeaveApprovalStep[]; status: LeaveStatus };

/**
 * What decide_leave() does: decides the waiting step and, on an approval, carries on through the
 * next steps the same person may decide. A rejection ends the chain; the leave is approved once
 * every step is.
 */
export function decideLeave(
  request: LeaveRequestParties,
  viewer: LeaveViewer,
  approve: boolean,
): LeaveDecisionResult {
  if (request.status !== "pending") {
    return { error: "This leave is not waiting for approval." };
  }
  if (request.personId === viewer.id) {
    return { error: "Nobody approves their own leave." };
  }
  if (approve && needsSlip(request.leaveType) && !request.hasSlip) {
    return { error: "Upload the slip before the leave is approved." };
  }

  const steps = [...request.steps].sort((a, b) => a.position - b.position);
  let decided = 0;
  const decision: LeaveDecision = approve ? "approved" : "rejected";
  for (const [index, step] of steps.entries()) {
    if (step.decision !== null) continue;
    if (!mayDecideStep(step, request, viewer)) break;
    steps[index] = { ...step, decision };
    decided++;
    if (!approve) break;
  }
  if (decided === 0) {
    return { error: "This leave is waiting for someone else." };
  }

  const status: LeaveStatus = !approve
    ? "rejected"
    : steps.every((step) => step.decision === "approved")
      ? "approved"
      : "pending";
  return { error: null, steps, status };
}

/** Own leave while pending, or once approved if it starts after today (Malaysia time). */
export const canCancelLeave = (
  request: Pick<LeaveRequestParties, "personId" | "status" | "startsOn">,
  viewer: Pick<LeaveViewer, "id">,
  today: CalendarDate,
) =>
  request.personId === viewer.id &&
  (request.status === "pending" ||
    (request.status === "approved" && request.startsOn > today));

const isOpen = (status: LeaveStatus) =>
  status === "pending" || status === "approved";

/** The person, the MD or HR & Accounts adds or replaces the slip of an open MC or hospitalisation. */
export const canUploadSlip = (
  request: Pick<LeaveRequestParties, "personId" | "leaveType" | "status">,
  viewer: LeaveViewer,
) =>
  needsSlip(request.leaveType) &&
  isOpen(request.status) &&
  (request.personId === viewer.id ||
    viewer.jobRole === "md" ||
    viewer.jobRole === "accounts");

/** Only the MD or HR & Accounts ticks "original given to HR", once there is a slip. */
export const canConfirmOriginalSlip = (
  request: Pick<LeaveRequestParties, "leaveType" | "status" | "hasSlip">,
  viewer: LeaveViewer,
) =>
  needsSlip(request.leaveType) &&
  isOpen(request.status) &&
  request.hasSlip &&
  (viewer.jobRole === "md" || viewer.jobRole === "accounts");
