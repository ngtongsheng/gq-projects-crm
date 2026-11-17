"use client";

import { Fragment } from "react";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import type { EventCostItem, EventSheet } from "./marketing-events";

const head =
  "h-9 px-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3 py-2 text-right font-mono tabular-nums";
const textCell = "px-3 py-2 whitespace-normal";

/** An event's costing on screen: the three tiles, the summary by cost group and every cost item. */
export function MarketingEventSheet({
  sheet,
  canEdit,
  onOpenItem,
}: {
  sheet: EventSheet;
  canEdit: boolean;
  /** Opens a cost line, or the expense behind an expense-log line, for editing. */
  onOpenItem: (item: EventCostItem) => void;
}) {
  const t = useT();
  const biggest = sheet.groups[0];
  return (
    <div className="flex flex-col gap-4">
      <TileGrid>
        <StatTile
          label={t("Total event cost")}
          value={
            <span className={cn(sheet.over && "text-bad")}>
              {formatRm(sheet.total)}
            </span>
          }
          note={
            sheet.budget === null || sheet.left === null
              ? t("No budget set")
              : sheet.over
                ? `${t("Budget")} ${formatRm(sheet.budget)} · ${t("over by")} ${formatRm(-sheet.left)}`
                : `${t("Budget")} ${formatRm(sheet.budget)} · ${formatRm(sheet.left)} ${t("left")}`
          }
        />
        <StatTile
          label={t("Cost items")}
          value={sheet.items.length}
          note={
            sheet.fromLog > 0
              ? `${sheet.fromLog} ${t("from expense log")}`
              : undefined
          }
        />
        <StatTile
          label={t("Biggest cost group")}
          value={biggest?.group ?? "–"}
          note={
            biggest
              ? `${formatRm(biggest.total)} · ${biggest.percent}%`
              : undefined
          }
        />
      </TileGrid>

      {sheet.items.length > 0 && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-medium">
              {t("Summary by cost group")}
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader className="bg-sunk">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={head}>{t("Group")}</TableHead>
                    <TableHead className={cn(head, "text-right")}>
                      {t("Total")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right")}>%</TableHead>
                    <TableHead className={cn(head, "w-1/4 max-md:hidden")} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.groups.map((group) => (
                    <TableRow key={group.group} className="hover:bg-sunk">
                      <TableCell className={textCell}>{group.group}</TableCell>
                      <TableCell className={numberCell}>
                        {formatRm(group.total)}
                      </TableCell>
                      <TableCell className={numberCell}>
                        {group.percent}%
                      </TableCell>
                      <TableCell className="max-md:hidden">
                        <div aria-hidden className="h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-chart-1"
                            style={{ width: `${Math.max(2, group.percent)}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold hover:bg-sunk">
                    <TableCell className={cn(textCell, "uppercase")}>
                      {t("Total")}
                    </TableCell>
                    <TableCell className={numberCell}>
                      {formatRm(sheet.total)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-heading text-base font-medium">
              {t("All cost items")}
            </h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table>
                <TableHeader className="bg-sunk">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={head}>{t("Description")}</TableHead>
                    <TableHead className={cn(head, "max-md:hidden")}>
                      {t("Supplier / ref")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right max-lg:hidden")}>
                      {t("Foreign amt")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right max-lg:hidden")}>
                      {t("Rate (RM)")}
                    </TableHead>
                    <TableHead className={cn(head, "max-lg:hidden")}>
                      {t("Unit")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right max-lg:hidden")}>
                      {t("Qty")}
                    </TableHead>
                    <TableHead className={cn(head, "text-right")}>
                      {t("Total")}
                    </TableHead>
                    <TableHead className={cn(head, "max-lg:hidden")}>
                      {t("Remarks")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.groups.map((group) => (
                    <Fragment key={group.group}>
                      <TableRow className="bg-sunk hover:bg-sunk">
                        <TableCell
                          colSpan={8}
                          className="px-3 py-1.5 text-xs font-semibold uppercase"
                        >
                          {group.group}
                        </TableCell>
                      </TableRow>
                      {group.items.map((item) => (
                        <CostItemRow
                          key={`${item.source}-${item.id}`}
                          item={item}
                          canEdit={canEdit}
                          onOpen={() => onOpenItem(item)}
                        />
                      ))}
                      <TableRow className="font-semibold hover:bg-sunk">
                        <TableCell className={cn(textCell, "text-right")}>
                          {t("Subtotal")}
                        </TableCell>
                        <TableCell className="max-md:hidden" />
                        <TableCell colSpan={4} className="max-lg:hidden" />
                        <TableCell className={numberCell}>
                          {formatRm(group.total)}
                        </TableCell>
                        <TableCell className="max-lg:hidden" />
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CostItemRow({
  item,
  canEdit,
  onOpen,
}: {
  item: EventCostItem;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const description = item.description ?? "";
  return (
    <TableRow className="align-top hover:bg-sunk">
      <TableCell className={textCell}>
        {canEdit ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-left font-medium hover:underline"
          >
            {description || t("(no description)")}
          </button>
        ) : (
          <span className="font-medium">{description}</span>
        )}{" "}
        {item.source === "log" && <StatusBadge>{t("Expense log")}</StatusBadge>}
      </TableCell>
      <TableCell className={cn(textCell, "max-md:hidden")}>
        {item.supplierRef}
      </TableCell>
      <TableCell className={cn(numberCell, "max-lg:hidden")}>
        {item.foreignAmount}
      </TableCell>
      <TableCell className={cn(numberCell, "max-lg:hidden")}>
        {item.rate === null ? "" : item.rate.toFixed(2)}
      </TableCell>
      <TableCell className={cn(textCell, "max-lg:hidden")}>
        {item.unit}
      </TableCell>
      <TableCell className={cn(numberCell, "max-lg:hidden")}>
        {item.qty}
      </TableCell>
      <TableCell className={cn(numberCell, "font-semibold")}>
        {item.total.toFixed(2)}
      </TableCell>
      <TableCell className={cn(textCell, "max-lg:hidden")}>
        {item.remarks}
      </TableCell>
    </TableRow>
  );
}
