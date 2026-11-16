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
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { availableQty, holdState, isLive } from "@/lib/domain/reservation";
import { pendingNotices, supplierEmails } from "@/lib/domain/supplier-notice";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
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
import { SupplierEmailDialog } from "./supplier-email-dialog";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("stock");
  const t = await getT(me.language);
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
  const active = reservations.filter((line) => isLive(line.status)).length;
  const toEmail = pendingNotices(reservations);
  const emails = supplierEmails(toEmail, {
    sender: me.fullName ?? "GQ Projects",
    today,
  });
  const summary = [
    expired > 0 && `${expired} ${t("expired")}`,
    expiring > 0 && `${expiring} ${t("expiring soon")}`,
    waiting > 0 &&
      (arranges
        ? `${waiting} ${t("to confirm")}`
        : `${waiting} ${t("waiting for confirmation")}`),
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
      {arranges && toEmail.length > 0 && (
        <SupplierEmailDialog
          emails={emails}
          pendingCount={toEmail.length}
          trigger="button"
        />
      )}
      {arranges && (
        <PasteImportDialog
          title={t("Paste stock from sheet")}
          description={t(
            "One row per SKU. A SKU already in stock keeps its unit; the columns you paste replace the saved ones.",
          )}
          kinds={[
            {
              value: "stock",
              label: t("Stock items"),
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
      title={view === "items" ? t("Stock") : t("Stock reserved")}
      description={
        summary.length > 0
          ? summary.join(" · ")
          : t(
              "What is on hand and what is held for clients, so the same stock is not promised twice.",
            )
      }
      actions={actions}
    />
  );

  if (view === "items") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <StockTabs t={t} active="items" />
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
      <StockTabs t={t} active="reservations" />
      <TileGrid className="lg:grid-cols-4">
        <StatTile
          label={t("Active reservations")}
          value={active}
          note={t("Reserved, PO issued or requested")}
        />
        <StatTile
          label={t("Expired - follow up")}
          value={
            <span className={expired > 0 ? "text-bad" : undefined}>
              {expired}
            </span>
          }
          note={t("Extend or release")}
        />
        <StatTile
          label={t("Expiring soon")}
          value={expiring}
          note={`${t("Within")} ${settings.warningDays} ${t("days")}`}
        />
        <StatTile
          label={t("Supplier emails to send")}
          value={toEmail.length}
          note={
            arranges && toEmail.length > 0 ? (
              <SupplierEmailDialog
                emails={emails}
                pendingCount={toEmail.length}
                trigger="link"
              />
            ) : (
              t("Reserve / extend / release")
            )
          }
        />
      </TileGrid>
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
              {t(option.label)}
            </Link>
          </Button>
        ))}
      </div>
      <ReservationsTable
        t={t}
        rows={shown}
        nameOf={nameOf}
        holdDays={settings.holdDays}
        arranges={arranges}
        canRequest={canRequest}
      />
    </div>
  );
}
