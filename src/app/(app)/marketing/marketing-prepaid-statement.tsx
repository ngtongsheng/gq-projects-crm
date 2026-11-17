"use client";

import { StatusBadge } from "@/components/app/status-badge";
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
import { formatForeign, type StatementRow } from "./marketing-prepaid";

const head =
  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3.5 py-2.5 text-right font-mono tabular-nums";

/** The entries of one vendor, or of all, with the balance after each (demo mkPreStatement). A top-up row is tinted. */
export function MarketingPrepaidStatement({
  rows,
  showVendor,
  canEdit,
  onOpen,
}: {
  rows: readonly StatementRow[];
  showVendor: boolean;
  canEdit: boolean;
  onOpen: (entryId: string) => void;
}) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-sunk">
          <TableRow className="hover:bg-transparent">
            <TableHead className={head}>{t("Date")}</TableHead>
            {showVendor && (
              <TableHead className={head}>{t("Vendor")}</TableHead>
            )}
            <TableHead className={head}>{t("Client – project")}</TableHead>
            <TableHead className={cn(head, "max-md:hidden")}>
              {t("MOF / ref")}
            </TableHead>
            <TableHead className={cn(head, "text-right max-lg:hidden")}>
              {t("Foreign amt")}
            </TableHead>
            <TableHead className={cn(head, "text-right")}>
              {t("Top-up (RM)")}
            </TableHead>
            <TableHead className={cn(head, "text-right")}>
              {t("Used (RM)")}
            </TableHead>
            <TableHead className={cn(head, "text-right")}>
              {t("Balance (RM)")}
            </TableHead>
            <TableHead className={cn(head, "max-lg:hidden")}>
              {t("Marketing?")}
            </TableHead>
            <TableHead className={cn(head, "max-lg:hidden")}>
              {t("Remarks")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                "align-top hover:bg-sunk",
                row.kind === "top_up" && "bg-good-bg/40",
              )}
            >
              <TableCell className="px-3.5 py-2.5 font-mono whitespace-nowrap tabular-nums">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onOpen(row.id)}
                    className="hover:underline"
                  >
                    {formatDate(row.entryOn)}
                  </button>
                ) : (
                  formatDate(row.entryOn)
                )}
              </TableCell>
              {showVendor && (
                <TableCell className="px-3.5 py-2.5">
                  {row.vendorName}
                </TableCell>
              )}
              <TableCell className="px-3.5 py-2.5 whitespace-normal">
                {row.description}
              </TableCell>
              <TableCell className="px-3.5 py-2.5 max-md:hidden">
                {row.mofRef}
              </TableCell>
              <TableCell className={cn(numberCell, "max-lg:hidden")}>
                {row.foreignCurrency && row.foreignAmount !== null
                  ? formatForeign(row.foreignCurrency, row.foreignAmount)
                  : ""}
              </TableCell>
              <TableCell className={numberCell}>
                {row.kind === "top_up" ? formatRm(row.amountRm) : ""}
              </TableCell>
              <TableCell className={numberCell}>
                {row.kind === "deduction" ? formatRm(row.amountRm) : ""}
              </TableCell>
              <TableCell
                className={cn(
                  numberCell,
                  "font-semibold",
                  row.runningBalance < 0 && "text-bad",
                )}
              >
                {formatRm(row.runningBalance)}
              </TableCell>
              <TableCell className="px-3.5 py-2.5 max-lg:hidden">
                {row.marketingFoc && (
                  <StatusBadge tone="info">{t("Yes")}</StatusBadge>
                )}
              </TableCell>
              <TableCell className="px-3.5 py-2.5 whitespace-normal text-muted-foreground max-lg:hidden">
                {row.remarks}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
