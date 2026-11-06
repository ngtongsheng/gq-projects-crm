import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { canSeeMofCost } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { csvResponse } from "@/lib/format/csv-response";
import { formatDate } from "@/lib/format/date";
import { filterMofs, parseMofFilters } from "../../mof-filters";
import { JobScopeLabel, MofStageLabel } from "../../schemas";
import { loadSummary } from "../summary-data";

/** The MOF summary as CSV: the same rows as the page for these filters. Cost and margin included. */
export async function GET(request: NextRequest) {
  const me = await requireSection("mof");
  if (!canSeeMofCost(me.jobRole)) redirect("/not-allowed");

  const filters = parseMofFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const rows = filterMofs(await loadSummary(), filters);

  return csvResponse(
    "mof-summary",
    [
      "MOF no.",
      "Company",
      "Project",
      "Salesperson",
      "Customer contact",
      "Accounts contact",
      "Job scope",
      "Product",
      "Installer",
      "Invoice (RM)",
      "Received (RM)",
      "Balance (RM)",
      "Received %",
      "Retention %",
      "Invoice no.",
      "Invoice date",
      "Days outstanding",
      "Cost (RM)",
      "Margin (RM)",
      "Margin %",
      "Total m2",
      "Delivery",
      "Stage",
    ],
    rows.map((row) => [
      row.mofNo,
      row.companyName,
      row.projectName,
      row.people,
      row.customerContact,
      row.accountsContact,
      JobScopeLabel[row.scope],
      row.products,
      row.installer,
      row.invoice,
      row.received,
      row.balance,
      row.receivedPct,
      row.retentionPct,
      row.invoiceNo,
      row.invoiceDate ? formatDate(row.invoiceDate) : null,
      row.daysOutstanding,
      row.cost,
      row.margin?.margin ?? null,
      row.margin?.marginPct ?? null,
      row.areaM2,
      row.deliveryDate ? formatDate(row.deliveryDate) : null,
      MofStageLabel[row.stage],
    ]),
  );
}
