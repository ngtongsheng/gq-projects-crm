"use client";

import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { formatForeign, usedByCurrency } from "./marketing-prepaid";
import type { PrepaidAccount, PrepaidEntry } from "./marketing-types";

function Line({
  label,
  value,
  quiet,
}: {
  label: string;
  value: string;
  quiet?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        quiet && "text-xs text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

/** One tile per prepaid account (demo mkPreView): the balance, turning red when negative or below the alert. */
export function MarketingPrepaidTiles({
  accounts,
  entries,
  selectedId,
  onSelect,
}: {
  accounts: readonly PrepaidAccount[];
  entries: readonly PrepaidEntry[];
  selectedId: string | null;
  onSelect: (vendorId: string) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <button
          key={account.vendorId}
          type="button"
          aria-pressed={account.vendorId === selectedId}
          onClick={() => onSelect(account.vendorId)}
          className={cn(
            "flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-left text-sm transition-colors hover:bg-sunk",
            account.vendorId === selectedId && "ring-2 ring-primary",
            account.low && "border-bad",
          )}
        >
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {account.vendorName}
          </span>
          <span
            className={cn(
              "font-mono text-2xl font-semibold tabular-nums",
              (account.balance < 0 || account.low) && "text-bad",
            )}
          >
            {formatRm(account.balance)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("balance")}
            {account.low && (
              <>
                {" · "}
                <strong className="text-bad">
                  {t("below")} {formatRm(account.lowBalanceAlert)} –{" "}
                  {t("top up soon")}
                </strong>
              </>
            )}
          </span>
          <div className="mt-1 flex flex-col gap-0.5">
            <Line label={t("Topped up")} value={formatRm(account.toppedUp)} />
            <Line
              label={`${t("Used")} (${account.jobs} ${t("jobs")})`}
              value={formatRm(account.used)}
            />
            {usedByCurrency(entries, account.vendorId).map(
              ({ currency, amount }) => (
                <Line
                  key={currency}
                  quiet
                  label={`${t("Used in")} ${currency}`}
                  value={formatForeign(currency, amount)}
                />
              ),
            )}
            {account.marketingFoc > 0 && (
              <Line
                quiet
                label={t("of which marketing (F.O.C)")}
                value={formatRm(account.marketingFoc)}
              />
            )}
            {account.lastTopUpOn && (
              <p className="text-xs text-muted-foreground">
                {t("Last top-up")} {formatDate(account.lastTopUpOn)}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
