import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { canOpen } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { getT } from "@/lib/i18n/server-t";
import { FormsView } from "./forms-view";
import { ToolsTabs } from "./tools-tabs";
import { parseToolsView } from "./tools-view";
import { VinylCalculator } from "./vinyl-calculator";
import { WallpaperCalculator } from "./wallpaper-calculator";

export const metadata: Metadata = { title: "Tools & Forms" };

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("tools");
  const t = await getT(me.language);
  const view = parseToolsView((await searchParams).view);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("Tools & Forms")}
        description={t(
          "Quick calculators for ordering quantity, and company forms ready to print. For calculation only – once you have the quantity, submit the sales order in Zoho as usual.",
        )}
      />
      <ToolsTabs active={view} t={t} />
      {view === "wallpaper" && <WallpaperCalculator />}
      {view === "vinyl" && <VinylCalculator />}
      {view === "forms" && (
        <FormsView
          canAddLinks={me.role === "admin"}
          canOpenStock={await canOpen(me, "stock")}
          t={t}
        />
      )}
    </div>
  );
}
