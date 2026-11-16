import { z } from "zod";
import { toCents } from "@/lib/format/money";

export const ADJUSTMENT_REASON_MAX = 300;

/** A line the checker may change: its stored amount next to what they typed. */
export type ReviewLine = {
  /** "ot" is section C's single amount; its id is the claim's. */
  kind: "commission" | "expense" | "ot";
  id: string;
  /** What the claim holds now. */
  amount: number;
  /** What the person claimed; the amount going back to this clears the adjustment. */
  originalAmount: number;
};

export type RequestedAmount = {
  kind: ReviewLine["kind"];
  id: string;
  amount: number;
};

export const AmountField = z
  .number({ error: "Enter each amount as a number." })
  .min(0, "An amount can't be below RM 0.")
  .max(1_000_000, "That amount is too large.");

export const ReviewRemark = z
  .string()
  .trim()
  .max(1000, "Keep the remark under 1000 characters.");

export const AdjustmentReason = z
  .string()
  .trim()
  .max(
    ADJUSTMENT_REASON_MAX,
    `Keep the reason under ${ADJUSTMENT_REASON_MAX} characters.`,
  );

export type PlannedChange = {
  kind: ReviewLine["kind"];
  id: string;
  amount: number;
  /** Null when the amount went back to what the person claimed. */
  reason: string | null;
};

/**
 * The lines whose amount differs from the stored one, each with the checker's reason. Any
 * change needs a reason the person will read (demo clSaveAdj); a line back at the claimed
 * amount drops its reason. Lines not in the claim are ignored.
 */
export function planAdjustments(
  lines: readonly ReviewLine[],
  requested: readonly RequestedAmount[],
  reason: string,
): { error: string } | { error: null; changes: PlannedChange[] } {
  const byKey = new Map(lines.map((line) => [`${line.kind}:${line.id}`, line]));
  const changes: PlannedChange[] = [];
  for (const want of requested) {
    const line = byKey.get(`${want.kind}:${want.id}`);
    if (!line || toCents(want.amount) === toCents(line.amount)) continue;
    const restored = toCents(want.amount) === toCents(line.originalAmount);
    changes.push({
      kind: want.kind,
      id: want.id,
      amount: want.amount,
      reason: restored ? null : reason.trim(),
    });
  }
  if (changes.some((change) => change.reason === "")) {
    return {
      error: "Write the reason for the adjustment, the person will see it.",
    };
  }
  return { error: null, changes };
}
