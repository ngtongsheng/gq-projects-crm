import type { StatusTone } from "@/components/app/status-badge";
import { fromCents, toCents } from "@/lib/format/money";

export const INSTALLER_CLAIM_TYPES = [
  "progress",
  "final",
  "deduction",
] as const;
export type InstallerClaimType = (typeof INSTALLER_CLAIM_TYPES)[number];

export const INSTALLER_CLAIM_TYPE_LABEL: Record<InstallerClaimType, string> = {
  progress: "Progress claim",
  final: "Final claim",
  deduction: "Deduction / back-charge",
};

export type InstallerClaimState =
  | "deduction"
  | "unverified"
  | "verified"
  | "paid";

export const INSTALLER_CLAIM_STATE_LABEL: Record<InstallerClaimState, string> =
  {
    deduction: "Deduction",
    unverified: "Not verified",
    verified: "Verified",
    paid: "Paid",
  };

export const INSTALLER_CLAIM_STATE_TONE: Record<
  InstallerClaimState,
  StatusTone
> = {
  deduction: "neutral",
  unverified: "warn",
  verified: "info",
  paid: "good",
};

type ClaimLike = {
  type: InstallerClaimType;
  amount: number;
  verified: boolean;
  /** Amount paid out against this claim, 0 when unpaid. */
  paidAmount: number;
};

export const claimState = (claim: ClaimLike): InstallerClaimState => {
  if (claim.type === "deduction") return "deduction";
  if (claim.paidAmount > 0) return "paid";
  return claim.verified ? "verified" : "unverified";
};

export type InstallerPoSummary = {
  claimed: number;
  deducted: number;
  /** Held back from the claimed work until the retention period ends. */
  retention: number;
  paid: number;
  /** Payable now: claimed - deductions - retention - paid, never below 0. */
  due: number;
  /** Room left on the PO for more progress or final claims. */
  leftToClaim: number;
  /** Progress and final claims the site supervisor has not verified yet. */
  unverifiedCount: number;
};

/**
 * What an installer PO owes, worked in whole cents. Retention is a percentage of
 * everything claimed, rounded to the nearest cent once on the total.
 */
export function summariseInstallerPo(
  po: { amount: number; retentionPct: number },
  claims: readonly ClaimLike[],
): InstallerPoSummary {
  const work = claims.filter((claim) => claim.type !== "deduction");
  const claimed = work.reduce((sum, claim) => sum + toCents(claim.amount), 0);
  const deducted = claims
    .filter((claim) => claim.type === "deduction")
    .reduce((sum, claim) => sum + toCents(claim.amount), 0);
  const paid = claims.reduce(
    (sum, claim) => sum + toCents(claim.paidAmount),
    0,
  );
  // Percent in hundredths (numeric(5,2)) keeps the multiplication on integers.
  const retention = Math.round(
    (claimed * Math.round(po.retentionPct * 100)) / 10000,
  );

  return {
    claimed: fromCents(claimed),
    deducted: fromCents(deducted),
    retention: fromCents(retention),
    paid: fromCents(paid),
    due: fromCents(Math.max(0, claimed - deducted - retention - paid)),
    leftToClaim: fromCents(Math.max(0, toCents(po.amount) - claimed)),
    unverifiedCount: work.filter((claim) => !claim.verified).length,
  };
}

/** True when progress and final claims together would pass the PO amount. */
export const exceedsInstallerPo = (
  poAmount: number,
  otherClaimed: number,
  newClaim: number,
): boolean => toCents(otherClaimed) + toCents(newClaim) > toCents(poAmount);
