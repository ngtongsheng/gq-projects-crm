import type { NextRequest } from "next/server";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  availableQty,
  holdLabel,
  holdState,
  isLive,
  RESERVATION_STATUS_LABEL,
  STOCK_UNIT_LABEL,
} from "@/lib/domain/reservation";
import { csvResponse } from "@/lib/format/csv-response";
import { formatDate, todayMyt } from "@/lib/format/date";
import {
  heldQty,
  parseFilter,
  reservedOnLabel,
  selectReservations,
} from "../reservation-filters";
import { loadReservations, loadStockItems } from "../stock-data";
import { loadStockSettings } from "../stock-settings";

/** The Stock page as CSV: `?view=items` for stock items, otherwise the reservations the filter shows. */
export async function GET(request: NextRequest) {
  await requireSection("stock");
  const params = request.nextUrl.searchParams;
  const reservations = await loadReservations();

  if (params.get("view") === "items") {
    const items = await loadStockItems();
    return csvResponse(
      "stock-items",
      ["SKU", "Collection", "Supplier", "On hand", "Held", "Available", "Unit"],
      items.map((item) => [
        item.sku,
        item.collection,
        item.supplier,
        item.qty,
        heldQty(item.id, reservations),
        availableQty(
          item.qty,
          reservations.filter((line) => line.itemId === item.id),
        ),
        STOCK_UNIT_LABEL[item.unit],
      ]),
    );
  }

  const [settings, team] = await Promise.all([
    loadStockSettings(),
    getTeamDirectory(),
  ]);
  const today = todayMyt();
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const shown = selectReservations(
    reservations.map((line) => ({
      line,
      hold: holdState(line, today, settings.warningDays),
    })),
    parseFilter(params.get("filter") ?? undefined),
  );

  return csvResponse(
    "stock-reservations",
    [
      "Reserved",
      "Salesperson",
      "Company",
      "Project",
      "MOF no.",
      "SKU",
      "Collection",
      "Supplier",
      "Qty",
      "Unit",
      "Status",
      "Needs attention",
      "Hold until",
      "Note",
    ],
    shown.map(({ line, hold }) => [
      reservedOnLabel(line),
      nameOf.get(line.reservedBy) ?? "Unnamed",
      line.companyName,
      line.projectName,
      line.mofNo,
      line.sku,
      line.collection,
      line.supplier,
      line.qty,
      STOCK_UNIT_LABEL[line.unit],
      RESERVATION_STATUS_LABEL[line.status],
      hold ? holdLabel(hold) : null,
      line.expiresOn && isLive(line.status) ? formatDate(line.expiresOn) : null,
      line.note,
    ]),
  );
}
