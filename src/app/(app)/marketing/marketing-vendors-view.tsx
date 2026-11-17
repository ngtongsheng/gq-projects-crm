"use client";

import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { whatsAppChatLink } from "@/lib/domain/installer";
import { formatDate } from "@/lib/format/date";
import { formatRm, sumRm } from "@/lib/format/money";
import { useT } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { dashboardYears } from "./marketing-dashboard";
import {
  VENDOR_SKILL_LABEL,
  VENDOR_SUPPLY_LABEL,
  type VendorKind,
} from "./marketing-options";
import type { MarketingVendor } from "./marketing-types";
import { MarketingVendorDialog } from "./marketing-vendor-dialog";
import {
  filterVendors,
  type VendorRow,
  type VendorSort,
  type VendorTab,
  vendorRows,
  vendorTabCounts,
} from "./marketing-vendors";
import { MarketingYearSelect } from "./marketing-year-select";

const head =
  "h-9 px-3.5 text-[11px] font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";
const numberCell = "px-3.5 py-2.5 text-right font-mono tabular-nums";

type MarketingVendorsViewProps = {
  vendors: readonly MarketingVendor[];
  year: string;
  today: string;
  canEdit: boolean;
};

/** The Vendors & part-timers tab (demo mkVendView): who is paid, what for, and how much this year. */
export function MarketingVendorsView({
  vendors,
  year,
  today,
  canEdit,
}: MarketingVendorsViewProps) {
  const t = useT();
  const [tab, setTab] = useState<VendorTab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<VendorSort>("name");
  // null: closed; "company" / "part_timer": adding that kind; otherwise the id of the vendor being edited.
  const [dialog, setDialog] = useState<VendorKind | string | null>(null);

  const rows = vendorRows(vendors, year);
  const counts = vendorTabCounts(rows);
  const shown = filterVendors(rows, { tab, query, sort });
  const editing = rows.find((row) => row.id === dialog);
  const adding = dialog === "company" || dialog === "part_timer";

  const tabs: { key: VendorTab; label: string; count: number }[] = [
    { key: "all", label: t("All"), count: counts.all },
    { key: "company", label: t("Companies"), count: counts.company },
    { key: "part_timer", label: t("Part-timers"), count: counts.part_timer },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex gap-1"
          role="tablist"
          aria-label={t("Vendor kind")}
        >
          {tabs.map(({ key, label, count }) => (
            <Button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              size="sm"
              variant={tab === key ? "default" : "outline"}
              onClick={() => setTab(key)}
            >
              {label} ({count})
            </Button>
          ))}
        </div>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search name, type, contact, note, email, skill")}
          aria-label={t("Search vendors")}
          className="w-full sm:w-80"
        />
        <Select
          value={sort}
          onValueChange={(value) => {
            if (value === "name" || value === "spend") setSort(value);
          }}
        >
          <SelectTrigger aria-label={t("Sort")} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("A to Z")}</SelectItem>
            <SelectItem value="spend">{t("Highest spend")}</SelectItem>
          </SelectContent>
        </Select>
        <MarketingYearSelect
          years={dashboardYears(
            vendors.flatMap((vendor) => vendor.payments),
            today,
          )}
          year={year}
          view="vendors"
        />
        {canEdit && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setDialog("part_timer")}>
              <Plus data-icon="inline-start" />
              {t("Add part-timer")}
            </Button>
            <Button onClick={() => setDialog("company")}>
              <Plus data-icon="inline-start" />
              {t("Add vendor")}
            </Button>
          </div>
        )}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Users}
            title={t("No vendor here")}
            description={
              vendors.length === 0
                ? t("A vendor is added when you use a new name on an expense.")
                : t("Nothing matches. Clear the search or the tab.")
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-sunk">
              <TableRow className="hover:bg-transparent">
                <TableHead className={head}>{t("Name")}</TableHead>
                <TableHead className={cn(head, "max-md:hidden")}>
                  {t("Supplies / skills")}
                </TableHead>
                <TableHead className={cn(head, "max-lg:hidden")}>
                  {t("Contact details")}
                </TableHead>
                <TableHead className={cn(head, "max-md:hidden text-right")}>
                  {t("Invoices")} {year}
                </TableHead>
                <TableHead className={cn(head, "text-right")}>
                  {t("Total")} {year}
                </TableHead>
                <TableHead className={cn(head, "max-lg:hidden")}>
                  {t("Last paid")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <VendorTableRow
                  key={row.id}
                  row={row}
                  canEdit={canEdit}
                  onOpen={() => setDialog(row.id)}
                />
              ))}
              <TableRow className="font-semibold hover:bg-sunk">
                <TableCell className="px-3.5 py-2.5 uppercase">
                  {t("Total")}
                </TableCell>
                <TableCell className="max-md:hidden" />
                <TableCell className="max-lg:hidden" />
                <TableCell className={cn(numberCell, "max-md:hidden")}>
                  {shown.reduce((sum, row) => sum + row.invoices, 0)}
                </TableCell>
                <TableCell className={numberCell}>
                  {formatRm(sumRm(shown.map((row) => row.total)))}
                </TableCell>
                <TableCell className="max-lg:hidden" />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit && (adding || editing) && (
        <MarketingVendorDialog
          key={dialog}
          vendor={editing}
          startKind={dialog === "part_timer" ? "part_timer" : "company"}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function VendorTableRow({
  row,
  canEdit,
  onOpen,
}: {
  row: VendorRow;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  const chat = row.phone ? whatsAppChatLink(row.phone) : null;
  return (
    <TableRow className="align-top hover:bg-sunk">
      <TableCell className="px-3.5 py-2.5 whitespace-normal">
        {canEdit ? (
          <button
            type="button"
            onClick={onOpen}
            className="text-left font-medium hover:underline"
          >
            {row.name}
          </button>
        ) : (
          <span className="font-medium">{row.name}</span>
        )}{" "}
        {row.kind === "part_timer" && (
          <StatusBadge tone="info">{t("Part-timer")}</StatusBadge>
        )}
        {row.notes && (
          <p className="text-xs text-muted-foreground">{row.notes}</p>
        )}
      </TableCell>
      <TableCell className="px-3.5 py-2.5 whitespace-normal max-md:hidden">
        <div className="flex flex-wrap gap-1">
          {row.supplies && (
            <StatusBadge>{t(VENDOR_SUPPLY_LABEL[row.supplies])}</StatusBadge>
          )}
          {row.skills.map((skill) => (
            <StatusBadge key={skill}>
              {t(VENDOR_SKILL_LABEL[skill])}
            </StatusBadge>
          ))}
        </div>
        {row.rate && (
          <p className="mt-1 text-xs text-muted-foreground">{row.rate}</p>
        )}
      </TableCell>
      <TableCell className="px-3.5 py-2.5 whitespace-normal max-lg:hidden">
        {row.contactPerson && <p>{row.contactPerson}</p>}
        {row.phone && (
          <p className="flex items-center gap-2 whitespace-nowrap">
            <a
              href={`tel:${row.phone}`}
              className="font-mono tabular-nums hover:underline"
            >
              {row.phone}
            </a>
            {chat && (
              <a
                href={chat}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${t("WhatsApp")} ${row.phone}`}
                className="text-xs font-medium text-good hover:underline"
              >
                {t("WhatsApp")}
              </a>
            )}
          </p>
        )}
        {row.email && (
          <p>
            <a href={`mailto:${row.email}`} className="hover:underline">
              {row.email}
            </a>
          </p>
        )}
        {row.portfolioUrl && (
          <p>
            <a
              href={row.portfolioUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {t("Portfolio")}
            </a>
          </p>
        )}
      </TableCell>
      <TableCell className={cn(numberCell, "max-md:hidden")}>
        {row.invoices || ""}
      </TableCell>
      <TableCell className={cn(numberCell, "font-semibold")}>
        {row.total > 0 ? row.total.toFixed(2) : "–"}
      </TableCell>
      <TableCell className="px-3.5 py-2.5 font-mono whitespace-nowrap tabular-nums max-lg:hidden">
        {row.lastPaidOn ? formatDate(row.lastPaidOn) : ""}
      </TableCell>
    </TableRow>
  );
}
