"use client";

import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n/language-context";
import { ClaimPrintButton } from "../claims/claim-print-button";
import type { PrepaidKind } from "./marketing-options";
import { statementRows } from "./marketing-prepaid";
import { MarketingPrepaidAlertDialog } from "./marketing-prepaid-alert-dialog";
import { MarketingPrepaidEntryDialog } from "./marketing-prepaid-entry-dialog";
import { MarketingPrepaidPrint } from "./marketing-prepaid-print";
import { MarketingPrepaidStatement } from "./marketing-prepaid-statement";
import { MarketingPrepaidTiles } from "./marketing-prepaid-tiles";
import type { PrepaidAccount, PrepaidEntry } from "./marketing-types";

const ALL = "all";

type Dialog =
  | { kind: PrepaidKind; entry?: PrepaidEntry }
  | { alert: PrepaidAccount };

type MarketingPrepaidViewProps = {
  accounts: readonly PrepaidAccount[];
  entries: readonly PrepaidEntry[];
  /** Vendor names offered while typing an entry's vendor. */
  vendors: readonly string[];
  /** The account the address asks for (a dashboard banner's Open); all entries when blank or unknown. */
  initialVendorId: string | null;
  canEdit: boolean;
  today: string;
  printedBy: string;
};

/** The Prepaid accounts tab (demo mkPreView): money paid ahead to a vendor, each job taken from it. */
export function MarketingPrepaidView({
  accounts,
  entries,
  vendors,
  initialVendorId,
  canEdit,
  today,
  printedBy,
}: MarketingPrepaidViewProps) {
  const t = useT();
  const [selectedId, setSelectedId] = useState(initialVendorId ?? ALL);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const selected = accounts.find((account) => account.vendorId === selectedId);
  const rows = statementRows(entries, selected?.vendorId ?? null);
  // A vendor chosen on a tile, or the only account there is, is where a new entry starts.
  const startVendor =
    (selected ?? (accounts.length === 1 ? accounts[0] : undefined))
      ?.vendorName ?? "";

  return (
    <>
      <div className="flex flex-col gap-4 print:hidden">
        <section className="flex flex-wrap items-start gap-3">
          <div className="mr-auto min-w-0">
            <h2 className="font-heading text-lg font-semibold">
              {t("Prepaid accounts")}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              {t(
                "Money paid in advance to a vendor (e.g. the Europe designer). Each job is deducted from the balance.",
              )}
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setDialog({ kind: "top_up" })}
              >
                <Plus data-icon="inline-start" />
                {t("Top up")}
              </Button>
              <Button onClick={() => setDialog({ kind: "deduction" })}>
                <Plus data-icon="inline-start" />
                {t("Deduct a job")}
              </Button>
            </div>
          )}
        </section>

        {accounts.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={Wallet}
              title={t("No prepaid account yet")}
              description={t(
                "Click Top up to record the first advance payment.",
              )}
            />
          </div>
        ) : (
          <>
            <MarketingPrepaidTiles
              accounts={accounts}
              entries={entries}
              selectedId={selected?.vendorId ?? null}
              onSelect={setSelectedId}
            />
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto font-heading text-base font-medium">
                  {selected
                    ? `${selected.vendorName} – ${t("statement")}`
                    : t("All entries")}
                </h2>
                <Select
                  value={selected?.vendorId ?? ALL}
                  onValueChange={setSelectedId}
                >
                  <SelectTrigger aria-label={t("Vendor")} className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("All vendors")}</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem
                        key={account.vendorId}
                        value={account.vendorId}
                      >
                        {account.vendorName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected && canEdit && (
                  <Button
                    variant="outline"
                    onClick={() => setDialog({ alert: selected })}
                  >
                    {t("Low-balance alert")}
                  </Button>
                )}
                {selected && <ClaimPrintButton label={t("Print statement")} />}
              </div>
              <MarketingPrepaidStatement
                rows={rows}
                showVendor={!selected}
                canEdit={canEdit}
                onOpen={(entryId) => {
                  const entry = entries.find((e) => e.id === entryId);
                  if (entry) setDialog({ kind: entry.kind, entry });
                }}
              />
            </section>
          </>
        )}
      </div>

      {selected && (
        <MarketingPrepaidPrint
          account={selected}
          rows={rows}
          printedOn={today}
          printedBy={printedBy}
          t={t}
        />
      )}

      {canEdit && dialog && "kind" in dialog && (
        <MarketingPrepaidEntryDialog
          key={dialog.entry?.id ?? dialog.kind}
          kind={dialog.kind}
          entry={dialog.entry}
          accounts={accounts}
          vendors={vendors}
          startVendor={startVendor}
          onClose={() => setDialog(null)}
        />
      )}
      {canEdit && dialog && "alert" in dialog && (
        <MarketingPrepaidAlertDialog
          account={dialog.alert}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
