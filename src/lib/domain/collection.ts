import type { StatusTone } from "@/components/app/status-badge";
import { fromCents, sumRm, toCents } from "@/lib/format/money";

/** Share of the order total that must be paid before commission opens, until the MD changes it. */
export const DEFAULT_PAYMENT_THRESHOLD_PCT = 90;

export type CollectionState =
  | "no_invoice"
  | "fully_paid"
  | "commission_open"
  | "partial";

export type CollectionSummary = {
  invoice: number;
  received: number;
  /** What is still owed; zero once paid in full, even if overpaid. */
  outstanding: number;
  /** Paid beyond the invoice; zero otherwise. */
  overpaid: number;
  /** Rounded down to 0.1, so 89.99% never reads as 90%. */
  pctPaid: number;
  state: CollectionState;
  label: string;
  tone: StatusTone;
};

/**
 * Where an order stands on collection. The invoice is the order total (contract sum plus VOs).
 * All comparisons run on whole cents.
 */
export function summariseCollection(
  invoice: number,
  payments: readonly number[],
  thresholdPct: number,
): CollectionSummary {
  const invoiceCents = toCents(invoice);
  const receivedCents = toCents(sumRm(payments));
  const base = {
    invoice,
    received: fromCents(receivedCents),
    outstanding: fromCents(Math.max(0, invoiceCents - receivedCents)),
    overpaid: fromCents(Math.max(0, receivedCents - invoiceCents)),
  };

  if (invoiceCents <= 0) {
    return {
      ...base,
      pctPaid: 0,
      state: "no_invoice",
      label: "No invoice",
      tone: "neutral",
    };
  }

  const pctPaid = Math.floor((receivedCents * 1000) / invoiceCents) / 10;
  if (receivedCents >= invoiceCents) {
    return {
      ...base,
      pctPaid,
      state: "fully_paid",
      label: "Fully paid",
      tone: "good",
    };
  }
  // Threshold in hundredths of a percent keeps the comparison in whole numbers.
  if (receivedCents * 10_000 >= Math.round(thresholdPct * 100) * invoiceCents) {
    return {
      ...base,
      pctPaid,
      state: "commission_open",
      label: `${thresholdPct}%+`,
      tone: "info",
    };
  }
  return {
    ...base,
    pctPaid,
    state: "partial",
    label: `${pctPaid}% paid`,
    tone: "warn",
  };
}
