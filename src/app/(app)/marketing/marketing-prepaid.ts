import { fromCents, toCents } from "@/lib/format/money";
import { PREPAID_CURRENCIES, type PrepaidCurrency } from "./marketing-options";
import type { PrepaidEntry } from "./marketing-types";

export type StatementRow = PrepaidEntry & {
  /** The vendor's balance after this entry. */
  runningBalance: number;
};

/**
 * The statement of one vendor, or of every vendor (null) one vendor after the other. Entries
 * run by date and then by when they were made (D8: the demo's id order showed a backdated
 * top-up after the job it paid for), and the balance runs per vendor.
 */
export function statementRows(
  entries: readonly PrepaidEntry[],
  vendorId: string | null,
): StatementRow[] {
  const running = new Map<string, number>();
  return entries
    .filter((entry) => vendorId === null || entry.vendorId === vendorId)
    .toSorted(
      (a, b) =>
        a.vendorName.localeCompare(b.vendorName) ||
        a.vendorId.localeCompare(b.vendorId) ||
        a.entryOn.localeCompare(b.entryOn) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .map((entry) => {
      const cents = toCents(entry.amountRm);
      const next =
        (running.get(entry.vendorId) ?? 0) +
        (entry.kind === "top_up" ? cents : -cents);
      running.set(entry.vendorId, next);
      return { ...entry, runningBalance: fromCents(next) };
    });
}

/** What a vendor's jobs cost in each foreign currency (demo "Used in EUR"); RM is not foreign. */
export function usedByCurrency(
  entries: readonly PrepaidEntry[],
  vendorId: string,
): { currency: PrepaidCurrency; amount: number }[] {
  return PREPAID_CURRENCIES.filter((currency) => currency !== "RM").flatMap(
    (currency) => {
      const cents = entries
        .filter(
          (entry) =>
            entry.vendorId === vendorId &&
            entry.kind === "deduction" &&
            entry.foreignCurrency === currency &&
            entry.foreignAmount !== null,
        )
        .reduce((sum, entry) => sum + toCents(entry.foreignAmount ?? 0), 0);
      return cents > 0 ? [{ currency, amount: fromCents(cents) }] : [];
    },
  );
}

export const formatForeign = (currency: PrepaidCurrency, amount: number) =>
  `${currency} ${amount.toFixed(2)}`;

/** "Rate: RM 4.8000 per EUR" while both amounts are keyed in; nothing for RM or a blank amount. */
export function exchangeRateText(
  amountRm: number,
  foreignAmount: number,
  currency: PrepaidCurrency,
): string | null {
  if (currency === "RM" || amountRm <= 0 || foreignAmount <= 0) return null;
  return `RM ${(amountRm / foreignAmount).toFixed(4)} per ${currency}`;
}
