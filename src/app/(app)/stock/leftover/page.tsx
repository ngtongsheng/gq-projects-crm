import type { Metadata } from "next";
import { DownloadCsvButton } from "@/components/app/download-csv-button";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { canEditStock } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  canRecordLeftover,
  creditNoteState,
  leftoverTransportState,
} from "@/lib/domain/leftover";
import { getT } from "@/lib/i18n/server-t";
import { loadReservableProjects, loadStockItems } from "../stock-data";
import { StockTabs } from "../stock-tabs";
import { BestLinkTable } from "./best-link-table";
import { importLeftovers, previewLeftoverImport } from "./import-actions";
import { loadLeftovers } from "./leftover-data";
import {
  countOnTheWay,
  parseBestLinkFilters,
  returnsInProgress,
  selectBestLinkItems,
} from "./leftover-filters";
import { leftoverImportFields } from "./leftover-import";
import { ReturnsTable } from "./returns-table";

export const metadata: Metadata = { title: "Leftover stock" };

export default async function LeftoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("stock");
  const t = await getT(me.language);
  const filters = parseBestLinkFilters(await searchParams);
  const canEdit = canEditStock(me);
  const [leftovers, team, projects, stockItems] = await Promise.all([
    loadLeftovers(),
    getTeamDirectory(),
    canEdit ? loadReservableProjects(me.id, true) : Promise.resolve([]),
    canEdit ? loadStockItems() : Promise.resolve([]),
  ]);

  const suppliers = [
    ...new Set([
      ...stockItems.map((item) => item.supplier),
      ...leftovers.flatMap((leftover) =>
        leftover.supplier ? [leftover.supplier] : [],
      ),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const returns = returnsInProgress(leftovers);
  const waitingForPickup = returns.filter(
    (leftover) => leftover.status === "pending_pickup",
  ).length;
  const needTransport = returns.filter(
    (leftover) => leftoverTransportState(leftover) === "to_arrange",
  ).length;
  const waitingForCreditNote = returns.filter(
    (leftover) => creditNoteState(leftover)?.kind === "pending",
  ).length;
  const summary = [
    waitingForPickup > 0 && `${waitingForPickup} ${t("waiting for pickup")}`,
    needTransport > 0 && `${needTransport} ${t("need transport")}`,
    waitingForCreditNote > 0 &&
      `${waitingForCreditNote} ${t("waiting for a supplier credit note")}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("Leftover stock")}
        description={t(
          "GQ's own stock at Best Link: items that cannot go back to the supplier (custom made, indent from China, GQ own stock, or stock ordered wrongly). Salespeople can sell them to another project. WhatsApp purchasing to use an item; they record it here.",
        )}
        actions={
          <>
            <DownloadCsvButton path="/stock/leftover/export" />
            {canRecordLeftover(me) && (
              <PasteImportDialog
                title={t("Paste leftover stock from sheet")}
                description={t(
                  "One row per item left over at a site. Each lands as waiting for pickup. Items already recorded are skipped.",
                )}
                canUpdate={false}
                kinds={[
                  {
                    value: "leftover",
                    label: t("Leftover stock"),
                    columns: leftoverImportFields.map((field) => field.label),
                  },
                ]}
                preview={previewLeftoverImport}
                save={importLeftovers}
              />
            )}
          </>
        }
      />
      <StockTabs t={t} active="leftover" />
      <BestLinkTable
        t={t}
        items={selectBestLinkItems(leftovers, filters)}
        filters={filters}
        onTheWay={countOnTheWay(leftovers)}
        canEdit={canEdit}
        people={team}
        projects={projects}
        suppliers={suppliers}
      />
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-heading text-lg font-semibold">
            {t("Returns from site")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {summary.length > 0
              ? summary.join(" · ")
              : t("From pickup to the supplier's credit note.")}
          </span>
        </div>
        <ReturnsTable
          t={t}
          items={returns}
          canEdit={canEdit}
          people={team}
          suppliers={suppliers}
        />
      </section>
    </div>
  );
}
