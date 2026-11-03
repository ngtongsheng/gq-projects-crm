import type { Metadata } from "next";
import Link from "next/link";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { Button } from "@/components/ui/button";
import {
  canChangeSettings,
  canEditStock,
  canRequestStock,
} from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { availableQty, holdState } from "@/lib/domain/reservation";
import { todayMyt } from "@/lib/format/date";
import { importStockItems, previewStockImport } from "./import-actions";
import {
  FILTERS,
  parseFilter,
  selectReservations,
} from "./reservation-filters";
import { ReservationsTable } from "./reservations-table";
import { ReserveStockDialog } from "./reserve-stock-dialog";
import {
  loadReservableProjects,
  loadReservations,
  loadStockItems,
} from "./stock-data";
import { stockImportFields } from "./stock-import";
import { StockItemDialog } from "./stock-item-dialog";
import { StockItemsTable } from "./stock-items-table";
import { loadStockSettings } from "./stock-settings";
import { StockSettingsDialog } from "./stock-settings-dialog";
import { StockTabs } from "./stock-tabs";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("stock");
  const params = await searchParams;
  const view = params.view === "items" ? "items" : "reservations";
  const filter = parseFilter(params.filter);
  const arranges = canEditStock(me);
  const canRequest = canRequestStock(me);
  const canSetSettings = canChangeSettings(me);

  const [items, reservations, settings, team, projects] = await Promise.all([
    loadStockItems(),
    loadReservations(),
    loadStockSettings(),
    getTeamDirectory(),
    canRequest ? loadReservableProjects(me.id, arranges) : Promise.resolve([]),
  ]);
  const today = todayMyt();
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const withHold = reservations.map((line) => ({
    line,
    hold: holdState(line, today, settings.warningDays),
  }));
  const expired = withHold.filter(
    ({ hold }) => hold?.kind === "expired",
  ).length;
  const expiring = withHold.filter(
    ({ hold }) => hold?.kind === "expiring",
  ).length;
  const waiting = withHold.filter(
    ({ hold }) => hold?.kind === "waiting",
  ).length;
  const summary = [
    expired > 0 && `${expired} expired`,
    expiring > 0 && `${expiring} expiring soon`,
    waiting > 0 &&
      (arranges
        ? `${waiting} to confirm`
        : `${waiting} waiting for confirmation`),
  ].filter(Boolean);

  const itemOptions = items
    .map((item) => ({
      id: item.id,
      label: `${item.sku}${item.collection ? ` · ${item.collection}` : ""}`,
      unit: item.unit,
      available: availableQty(
        item.qty,
        reservations.filter((line) => line.itemId === item.id),
      ),
    }))
    .filter((option) => option.available > 0);

  const actions = (
    <>
      <DownloadCsvButton
        path="/stock/export"
        query={view === "items" ? { view } : { filter }}
      />
      {canSetSettings && <StockSettingsDialog settings={settings} />}
      {arranges && (
        <PasteImportDialog
          title="Paste stock from sheet"
          description="One row per SKU. A SKU already in stock keeps its unit; the columns you paste replace the saved ones."
          kinds={[
            {
              value: "stock",
              label: "Stock items",
              columns: stockImportFields.map((field) => field.label),
            },
          ]}
          preview={previewStockImport}
          save={importStockItems}
        />
      )}
      {arranges && <StockItemDialog />}
      {canRequest && (
        <ReserveStockDialog
          items={itemOptions}
          projects={projects}
          salespeople={team}
          meId={me.id}
          confirmsDirectly={arranges}
        />
      )}
    </>
  );

  const header = (
    <PageHeader
      title="Stock"
      description={
        summary.length > 0
          ? summary.join(" · ")
          : "What is on hand and what is held for clients, so the same stock is not promised twice."
      }
      actions={actions}
    />
  );

  if (view === "items") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <StockTabs active="items" />
        <StockItemsTable
          items={items}
          reservations={reservations}
          arranges={arranges}
        />
      </div>
    );
  }

  const shown = selectReservations(withHold, filter);

  return (
    <div className="flex flex-col gap-6">
      {header}
      <StockTabs active="reservations" />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={option.key === filter ? "default" : "outline"}
            asChild
          >
            <Link
              href={
                option.key === "active"
                  ? "/stock"
                  : `/stock?filter=${option.key}`
              }
            >
              {option.label}
            </Link>
          </Button>
        ))}
      </div>
      <ReservationsTable
        rows={shown}
        nameOf={nameOf}
        holdDays={settings.holdDays}
        arranges={arranges}
        canRequest={canRequest}
      />
    </div>
  );
}
