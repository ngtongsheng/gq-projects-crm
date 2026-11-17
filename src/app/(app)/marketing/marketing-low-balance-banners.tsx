import Link from "next/link";
import { formatRm } from "@/lib/format/money";
import type { Translate } from "@/lib/i18n/translate";
import type { PrepaidAccount } from "./marketing-types";

/** One banner for each prepaid account below its alert, opening that account (demo mkDash). */
export function MarketingLowBalanceBanners({
  accounts,
  t,
}: {
  accounts: readonly PrepaidAccount[];
  t: Translate;
}) {
  const low = accounts.filter((account) => account.low);
  if (low.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {low.map((account) => (
        <output
          key={account.vendorId}
          className="flex flex-wrap items-center gap-3 rounded-lg bg-warn-bg px-3.5 py-3 text-sm text-warn"
        >
          <span className="min-w-0 flex-1">
            <strong>{account.vendorName}</strong> {t("prepaid balance is")}{" "}
            <span className="font-mono tabular-nums">
              {formatRm(account.balance)}
            </span>{" "}
            – {t("below")}{" "}
            <span className="font-mono tabular-nums">
              {formatRm(account.lowBalanceAlert)}
            </span>
            . {t("Top up soon.")}
          </span>
          <Link
            href={`/marketing?view=prepaid&vendor=${account.vendorId}`}
            className="font-medium underline-offset-2 hover:underline"
          >
            {t("Open")}
          </Link>
        </output>
      ))}
    </div>
  );
}
