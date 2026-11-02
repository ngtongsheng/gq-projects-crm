import { fromCents, toCents } from "@/lib/format/money";

export type CommissionType = "own" | "pass_down" | "company";

// Placeholder until the commission rules (task 25) replace it; callers only use estimatedCommission.
const RATE: Record<CommissionType, number> = {
  own: 0.03,
  pass_down: 0.015,
  company: 0.015,
};

/** Rough commission shown on the pipeline: project value times the rate for its commission type. */
export function estimatedCommission(
  value: number,
  commissionType: CommissionType,
): number {
  return fromCents(Math.round(toCents(value) * RATE[commissionType]));
}
