"use client";

import { Gift, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format/date";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { MarketingGiveawayDialog } from "./marketing-giveaway-dialog";
import { filterGiveaways, supplierSuggestions } from "./marketing-giveaways";
import type { Giveaway } from "./marketing-types";

const head =
  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3.5 py-2.5 text-right font-mono tabular-nums";

type MarketingGiveawayViewProps = {
  giveaways: readonly Giveaway[];
  /** Company names offered for who a line was given to. */
  customers: readonly string[];
  canEdit: boolean;
};

/** The Sample give-away tab (demo mkGiveView): what catalogues and samples were given away, and what it cost. Not part of the dashboard totals. */
export function MarketingGiveawayView({
  giveaways,
  customers,
  canEdit,
}: MarketingGiveawayViewProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  // null: closed; "new": adding; otherwise the line being edited.
  const [dialog, setDialog] = useState<Giveaway | "new" | null>(null);

  const { lines, total } = filterGiveaways(giveaways, query);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">
          {t("Sample & catalogue give-away")}
        </h2>
        <span className="font-mono text-sm text-muted-foreground tabular-nums">
          {lines.length} {t("lines")} · {formatRm(total)}
        </span>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search client, item, supplier")}
          aria-label={t("Search give-aways")}
          className="w-full sm:ml-auto sm:w-64"
        />
        {canEdit && (
          <Button onClick={() => setDialog("new")}>
            <Plus data-icon="inline-start" />
            {t("Add give-away")}
          </Button>
        )}
      </div>
      {lines.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Gift}
            title={t("No give-away yet")}
            description={
              giveaways.length === 0
                ? t("Click Add give-away to record the first one.")
                : t("Nothing matches. Clear the search.")
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-sunk">
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>{t("Date")}</TableHead>
                <TableHead className={cn(head, "max-md:hidden")}>
                  {t("Supplier")}
                </TableHead>
                <TableHead className={cn(head, "max-lg:hidden")}>
                  {t("Invoice no.")}
                </TableHead>
                <TableHead className={head}>{t("Item")}</TableHead>
                <TableHead className={head}>
                  {t("Given to (client / project)")}
                </TableHead>
                <TableHead className={cn(head, "text-right")}>
                  {t("Qty")}
                </TableHead>
                <TableHead className={cn(head, "text-right max-md:hidden")}>
                  {t("Unit cost")}
                </TableHead>
                <TableHead className={cn(head, "text-right")}>
                  {t("Total (RM)")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id} className="align-top hover:bg-sunk">
                  <TableCell className="px-3.5 py-2.5 font-mono whitespace-nowrap tabular-nums">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setDialog(line)}
                        className="hover:underline"
                      >
                        {formatDate(line.givenOn)}
                      </button>
                    ) : (
                      formatDate(line.givenOn)
                    )}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 whitespace-normal max-md:hidden">
                    {line.supplier}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 max-lg:hidden">
                    {line.invoiceNo}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 whitespace-normal">
                    {line.item}
                  </TableCell>
                  <TableCell className="px-3.5 py-2.5 whitespace-normal">
                    {line.givenTo}
                  </TableCell>
                  <TableCell className={numberCell}>{line.qty}</TableCell>
                  <TableCell className={cn(numberCell, "max-md:hidden")}>
                    {line.unitCost.toFixed(2)}
                  </TableCell>
                  <TableCell className={cn(numberCell, "font-semibold")}>
                    {line.total.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit && dialog !== null && (
        <MarketingGiveawayDialog
          key={dialog === "new" ? "new" : dialog.id}
          giveaway={dialog === "new" ? undefined : dialog}
          suppliers={supplierSuggestions(giveaways)}
          customers={customers}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
