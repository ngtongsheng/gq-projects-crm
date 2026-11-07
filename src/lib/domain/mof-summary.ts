import { type CalendarDate, daysBetween } from "@/lib/format/date";
import { fromCents, toCents } from "@/lib/format/money";

export type Margin = {
  /** What is left of the invoice after our cost; negative when the job lost money. */
  margin: number;
  /** Margin as a share of the invoice, to 0.1; null when there is no invoice yet. */
  marginPct: number | null;
};

/** Margin and margin % from the invoice amount and our cost, on whole cents. */
export function marginOf(invoice: number, cost: number): Margin {
  const invoiceCents = toCents(invoice);
  const marginCents = invoiceCents - toCents(cost);
  return {
    margin: fromCents(marginCents),
    marginPct:
      invoiceCents > 0
        ? Math.round((marginCents * 1000) / invoiceCents) / 10
        : null,
  };
}

/** Received as a share of the invoice, to 0.1, never above 100; null when there is no invoice. */
export function receivedPct(invoice: number, received: number): number | null {
  const invoiceCents = toCents(invoice);
  if (invoiceCents <= 0) return null;
  const pct = Math.round((toCents(received) * 1000) / invoiceCents) / 10;
  return Math.min(100, pct);
}

/** Days since the invoice date while money is still owed; null when invoiced nothing, unpaid nothing or not yet invoiced. */
export function daysOutstanding(
  invoiceDate: CalendarDate | null,
  outstanding: number,
  today: CalendarDate,
): number | null {
  if (!invoiceDate || toCents(outstanding) <= 0) return null;
  return Math.max(0, daysBetween(invoiceDate, today));
}
