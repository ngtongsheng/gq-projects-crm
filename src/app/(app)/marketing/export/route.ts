import { requirePage } from "@/lib/auth/require-page";
import { todayMyt } from "@/lib/format/date";
import {
  loadMarketingCategories,
  loadMarketingExpenses,
  loadMarketingVendors,
} from "../marketing-data";
import { loadMarketingEvents } from "../marketing-events-data";
import {
  buildMarketingWorkbook,
  exportFileName,
} from "../marketing-excel-export";
import { XLSX_TYPE } from "../marketing-excel-layout";
import { loadGiveaways } from "../marketing-giveaway-data";
import { loadPrepaidEntries } from "../marketing-prepaid-data";

/** The marketing records as one Excel workbook (demo mkExport). Everyone who sees the page may download it. */
export async function GET() {
  await requirePage("mkt");
  const [categories, expenses, events, vendors, prepaid, giveaways] =
    await Promise.all([
      loadMarketingCategories(),
      loadMarketingExpenses(),
      loadMarketingEvents(),
      loadMarketingVendors(),
      loadPrepaidEntries(),
      loadGiveaways(),
    ]);
  const today = todayMyt();
  const file = await buildMarketingWorkbook({
    categories,
    expenses,
    events,
    vendors,
    prepaid,
    giveaways,
    today,
  });
  return new Response(file, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${exportFileName(today)}"`,
      "Cache-Control": "no-store",
    },
  });
}
