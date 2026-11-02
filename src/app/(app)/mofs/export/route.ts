import type { NextRequest } from "next/server";
import { requireSection } from "@/lib/auth/require-section";
import { csvResponse } from "@/lib/format/csv-response";
import { formatDate } from "@/lib/format/date";
import { loadRegister } from "../mof-data";
import { parseMofFilters, seesOnlyOwnMofs, visibleMofs } from "../mof-filters";
import { MofStageLabel } from "../schemas";

/** The MOF register as CSV: same rows as the page for this person and these filters. No costs. */
export async function GET(request: NextRequest) {
  const me = await requireSection("mof");
  const filters = parseMofFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const rows = visibleMofs(await loadRegister(), me, filters);

  return csvResponse(
    seesOnlyOwnMofs(me.jobRole) ? "my-sales" : "mof-register",
    [
      "MOF no.",
      "LOA date",
      "Salesperson",
      "Company",
      "Project",
      "Order total (RM)",
      "Delivery",
      "Stage",
      "Checks done (of 4)",
      "No supplier PO",
      "Latest update",
    ],
    rows.map((row) => [
      row.mofNo,
      formatDate(row.loaDate),
      row.people,
      row.companyName,
      row.projectName,
      row.total,
      row.deliveryDate ? formatDate(row.deliveryDate) : null,
      MofStageLabel[row.stage],
      row.ticks,
      row.missingSupplierPo ? "Yes" : "No",
      row.latestUpdate,
    ]),
  );
}
