import { formatRm, toCents } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";

/** Under a line the checker changed: what the person claimed and the reason (demo adjTag). */
export function AdjustedNote({
  originalAmount,
  amount,
  reason,
  t,
}: {
  originalAmount: number;
  amount: number;
  reason: string | null;
  t: Translate;
}) {
  if (toCents(originalAmount) === toCents(amount)) return null;
  return (
    <span className="block text-xs text-warn">
      {t("Adjusted from")} {formatRm(originalAmount)}
      {reason ? `: ${reason}` : ""}
    </span>
  );
}
