import type { LeaveStatus, LeaveType } from "./leave-balance";

// The demo's words (LV_TYPES, lvPill).
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: "Annual leave",
  mc: "Medical leave (MC)",
  emergency: "Emergency leave",
  hospitalisation: "Hospitalisation leave",
  replacement: "Replacement leave",
  compassionate: "Compassionate leave",
  maternity_paternity: "Maternity / paternity leave",
  unpaid: "Unpaid leave",
};

export const LEAVE_TYPE_SHORT: Record<LeaveType, string> = {
  annual: "AL",
  mc: "MC",
  emergency: "EL",
  hospitalisation: "HL",
  replacement: "RL",
  compassionate: "CL",
  maternity_paternity: "ML",
  unpaid: "UL",
};

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "Waiting approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
