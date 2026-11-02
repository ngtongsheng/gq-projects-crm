import { fromCents, sumRm, toCents } from "@/lib/format/money";

export type CommissionBalance = {
  paidOut: number;
  /** Earned and not yet paid out; zero once paid in full or overpaid. */
  remaining: number;
  /** What may be paid out now: the remaining amount, once the order has reached the claim threshold. */
  payableNow: number;
};

/** Where one person stands on one order: earned, paid out, and what can be paid out now. */
export function commissionBalance(
  person: { earned: number; claimable: boolean },
  payouts: readonly number[],
): CommissionBalance {
  const paidOut = sumRm(payouts);
  const remaining = fromCents(
    Math.max(0, toCents(person.earned) - toCents(paidOut)),
  );
  return { paidOut, remaining, payableNow: person.claimable ? remaining : 0 };
}
