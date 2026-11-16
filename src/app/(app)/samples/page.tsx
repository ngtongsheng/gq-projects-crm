import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PasteImportDialog } from "@/components/app/paste-import-dialog";
import { canEditSamples } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { sampleTotals } from "@/lib/domain/samples";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import { StockTabs } from "../stock/stock-tabs";
import { importSamples, previewSampleImport } from "./import-actions";
import { PickupFormDialog } from "./pickup-form-dialog";
import { PickupFormsTable } from "./pickup-forms-table";
import { PickupSettingsDialog } from "./pickup-settings-dialog";
import { SampleDialog } from "./sample-dialog";
import { sampleImportFields } from "./sample-import";
import { SampleSelectionProvider } from "./sample-selection";
import {
  loadPickupForms,
  loadPickupSettings,
  loadSamples,
} from "./samples-data";
import { SamplesList } from "./samples-list";

export const metadata: Metadata = { title: "Samples at Best Link" };

/** Samples GQ keeps at the Best Link warehouse, and the pickup forms that collect them (demo vSamples). */
export default async function SamplesPage() {
  const me = await requirePage("stock");
  const t = await getT(me.language);
  const canEdit = canEditSamples(me);
  const [samples, forms, settings, team] = await Promise.all([
    loadSamples(),
    loadPickupForms(),
    loadPickupSettings(),
    getTeamDirectory(),
  ]);
  const totals = sampleTotals(samples);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const brands = [
    ...new Set(samples.map((sample) => sample.brand).filter(Boolean)),
  ].sort();
  const pickupProps = {
    samples: samples.map((sample) => ({
      id: sample.id,
      label: sample.sku || sample.name,
      name: sample.name,
      brand: sample.brand,
      spec: sample.spec,
      unit: sample.unit,
      qty: sample.qty,
    })),
    team,
    meName: me.fullName ?? "",
    today: todayMyt(),
  };

  return (
    <SampleSelectionProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("Samples at Best Link")}
          description={`${t("Samples GQ keeps at the Best Link warehouse (e.g. Unijoy carpet tile, vinyl tile). One line per SKU with how many we keep: 1 pc, 1 box...")} ${
            canEdit
              ? t(
                  "Record when someone takes a sample out, so we know where it went.",
                )
              : t("To take a sample, WhatsApp Jess; she records it here.")
          }`}
          actions={
            canEdit && (
              <>
                <PickupFormDialog {...pickupProps} placement="header" />
                <PasteImportDialog
                  title={t("Paste samples from sheet")}
                  description={t(
                    "One row per SKU. A sample already in the list keeps its unit; the columns you paste replace the saved ones, quantity included.",
                  )}
                  kinds={[
                    {
                      value: "samples",
                      label: t("Samples"),
                      columns: sampleImportFields.map((field) => field.label),
                    },
                  ]}
                  preview={previewSampleImport}
                  save={importSamples}
                />
                <SampleDialog brands={brands} />
                <PickupSettingsDialog settings={settings} />
              </>
            )
          }
        />
        <StockTabs t={t} active="samples" />
        <TileGrid className="lg:grid-cols-3">
          <StatTile
            label={t("Sample SKUs")}
            value={totals.skus}
            note={
              totals.perProduct
                .map(([product, count]) => `${product} ${count}`)
                .join(" · ") || "–"
            }
          />
          <StatTile
            label={t("Taken out, not back")}
            value={totals.takenOut}
            note={t("With salesperson / client")}
          />
          <StatTile
            label={t("None left")}
            value={
              <span className={totals.noneLeft > 0 ? "text-bad" : undefined}>
                {totals.noneLeft}
              </span>
            }
            note={t("Ask the brand for more")}
          />
        </TileGrid>
        <SamplesList
          samples={samples}
          team={team}
          meId={me.id}
          canEdit={canEdit}
          pickupButton={
            <PickupFormDialog {...pickupProps} placement="toolbar" />
          }
        />
        <p className="text-sm text-muted-foreground">
          {t(
            "Take out: the sample leaves Best Link (to a salesperson, client or showroom) and the quantity goes down. A pickup form does this for you. Back: it is returned and the quantity goes up again. Each sample keeps its own history.",
          )}
        </p>
        {forms.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-heading text-lg font-semibold">
                {t("Pickup forms")}
              </h2>
              <span className="text-sm text-muted-foreground">
                {forms.length}
              </span>
            </div>
            <PickupFormsTable t={t} forms={forms} nameOf={nameOf} />
            {settings.driveFolderUrl && (
              <p className="text-sm">
                <a
                  href={settings.driveFolderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t("Open Drive folder")}
                </a>
              </p>
            )}
          </section>
        )}
      </div>
    </SampleSelectionProvider>
  );
}
