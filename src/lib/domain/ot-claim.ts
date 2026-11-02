import type { StatusTone } from "@/components/app/status-badge";

// Values mirror the check constraints in the ot_claims migration.
export const OT_CLAIM_TYPES = ["ot", "replacement_leave"] as const;
export type OtClaimType = (typeof OT_CLAIM_TYPES)[number];

export const OT_CLAIM_TYPE_LABEL: Record<OtClaimType, string> = {
  ot: "OT claim",
  replacement_leave: "Replacement leave",
};

export const OT_STATUSES = ["pending", "approved", "rejected"] as const;
export type OtStatus = (typeof OT_STATUSES)[number];

export const OT_STATUS_LABEL: Record<OtStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const OT_STATUS_TONE: Record<OtStatus, StatusTone> = {
  pending: "warn",
  approved: "good",
  rejected: "bad",
};

/** What the approver picks: approve as one of the two, or reject. */
export const OT_DECISIONS = ["ot", "replacement_leave", "reject"] as const;
export type OtDecision = (typeof OT_DECISIONS)[number];

/** The columns a decision writes. */
export function decisionColumns(decision: OtDecision): {
  status: "approved" | "rejected";
  approved_as: OtClaimType | null;
} {
  return decision === "reject"
    ? { status: "rejected", approved_as: null }
    : { status: "approved", approved_as: decision };
}

/** Hours of approved claims, split by how they were approved. Pending hours are counted apart. */
export function otTotals(
  claims: readonly {
    hours: number;
    status: OtStatus;
    approvedAs: OtClaimType | null;
  }[],
) {
  const totals = { ot: 0, replacementLeave: 0, pending: 0 };
  for (const claim of claims) {
    if (claim.status === "pending") totals.pending += claim.hours;
    else if (claim.approvedAs === "ot") totals.ot += claim.hours;
    else if (claim.approvedAs === "replacement_leave") {
      totals.replacementLeave += claim.hours;
    }
  }
  return totals;
}
