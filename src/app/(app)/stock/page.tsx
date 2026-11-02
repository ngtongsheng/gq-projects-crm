import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/app/data-table";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { Button } from "@/components/ui/button";
import { canEditStock } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  availableQty,
  holdState,
  isLive,
  STOCK_UNIT_LABEL,
  supplierMailto,
} from "@/lib/domain/reservation";
import { formatDate, todayMyt } from "@/lib/format/date";
import { importStockItems, previewStockImport } from "./import-actions";
import { ReservationActions } from "./reservation-actions";
import { ReservationBadges } from "./reservation-badges";
import {
  FILTERS,
  heldQty,
  parseFilter,
  reservedOnLabel,
  selectReservations,
} from "./reservation-filters";
import { ReserveStockDialog } from "./reserve-stock-dialog";
import {
  loadReservableProjects,
  loadReservations,
  loadStockItems,
} from "./stock-data";
import { stockImportFields } from "./stock-import";
import { StockItemDialog } from "./stock-item-dialog";
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
  const canRequest = arranges || me.jobRole === "bd" || me.jobRole === "sales";
  const canSetSettings = me.role === "admin" || me.jobRole === "md";

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
        <DataTable
          rows={items}
          getRowKey={(item) => item.id}
          empty={
            <EmptyState
              icon={Boxes}
              title="No stock items yet"
              description="Whoever arranges stock adds each SKU here."
            />
          }
          columns={[
            {
              key: "sku",
              header: "SKU",
              cell: (item) => (
                <div className="flex min-w-40 flex-col">
                  <span className="font-mono text-sm font-medium">
                    {item.sku}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.collection}
                  </span>
                </div>
              ),
            },
            {
              key: "supplier",
              header: "Supplier",
              cell: (item) => item.supplier,
            },
            {
              key: "onHand",
              header: "On hand",
              numeric: true,
              cell: (item) =>
                `${item.qty.toLocaleString("en-MY")} ${STOCK_UNIT_LABEL[item.unit]}`,
            },
            {
              key: "held",
              header: "Held",
              numeric: true,
              cell: (item) =>
                heldQty(item.id, reservations).toLocaleString("en-MY"),
            },
            {
              key: "available",
              header: "Available",
              numeric: true,
              cell: (item) => (
                <span className="font-semibold">
                  {availableQty(
                    item.qty,
                    reservations.filter((line) => line.itemId === item.id),
                  ).toLocaleString("en-MY")}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              cell: (item) =>
                arranges ? <StockItemDialog item={item} /> : null,
            },
          ]}
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
      <DataTable
        rows={shown}
        getRowKey={({ line }) => line.id}
        empty={
          <EmptyState
            icon={Boxes}
            title="No reservations in this view"
            description={
              canRequest
                ? "Use the button above to hold stock for a project."
                : "Salespeople request a hold on stock for their projects."
            }
          />
        }
        columns={[
          {
            key: "when",
            header: "Reserved",
            numeric: true,
            cell: ({ line }) => reservedOnLabel(line),
          },
          {
            key: "who",
            header: "Salesperson",
            cell: ({ line }) => nameOf.get(line.reservedBy) ?? "Unnamed",
          },
          {
            key: "project",
            header: "Client · project",
            cell: ({ line }) => (
              <div className="flex min-w-40 flex-col">
                <span className="font-medium">{line.companyName}</span>
                <span className="text-xs text-muted-foreground">
                  {line.projectName}
                  {line.mofNo ? ` · ${line.mofNo}` : ""}
                </span>
              </div>
            ),
          },
          {
            key: "sku",
            header: "SKU",
            cell: ({ line }) => (
              <div className="flex min-w-36 flex-col">
                <span className="font-mono text-sm font-medium">
                  {line.sku}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[line.collection, line.supplier].filter(Boolean).join(" · ")}
                </span>
                {line.note && (
                  <span className="text-xs text-muted-foreground">
                    {line.note}
                  </span>
                )}
              </div>
            ),
          },
          {
            key: "qty",
            header: "Qty",
            numeric: true,
            cell: ({ line }) =>
              `${line.qty.toLocaleString("en-MY")} ${STOCK_UNIT_LABEL[line.unit]}`,
          },
          {
            key: "status",
            header: "Status",
            cell: ({ line, hold }) => (
              <ReservationBadges status={line.status} hold={hold} />
            ),
          },
          {
            key: "until",
            header: "Hold until",
            numeric: true,
            cell: ({ line }) =>
              line.expiresOn && isLive(line.status)
                ? formatDate(line.expiresOn)
                : "",
          },
          {
            key: "actions",
            header: "",
            cell: ({ line }) =>
              arranges ? (
                <ReservationActions
                  reservationId={line.id}
                  status={line.status}
                  holdDays={settings.holdDays}
                  mailto={supplierMailto({
                    ...line,
                    projectName: line.projectName,
                  })}
                />
              ) : null,
          },
        ]}
      />
    </div>
  );
}
