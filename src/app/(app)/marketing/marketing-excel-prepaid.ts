import { cellDate, type SheetRow } from "./marketing-excel-cells";
import { PREPAID_HEADERS } from "./marketing-excel-layout";
import type { ImportContext } from "./marketing-excel-plan";
import { prepaidEntrySchema } from "./marketing-prepaid-input";

export function readPrepaid(
  ctx: ImportContext,
  sheetName: string,
  row: SheetRow,
) {
  const topUp = row.text(PREPAID_HEADERS.topUp);
  const used = row.text(PREPAID_HEADERS.used);
  const date = cellDate(row.cell(PREPAID_HEADERS.date));
  if (date === "" && topUp === "" && used === "") return;
  if (topUp !== "" && used !== "") {
    ctx.report(
      sheetName,
      row.number,
      "A line is either a top-up or used, not both.",
    );
    return;
  }
  const foreignCurrency = row.text(PREPAID_HEADERS.foreignCurrency);
  const parsed = prepaidEntrySchema.safeParse({
    id: "",
    kind: used !== "" ? "deduction" : "top_up",
    entryOn: date,
    vendor: row.text(PREPAID_HEADERS.vendor),
    description: row.text(PREPAID_HEADERS.description),
    foreignCurrency: foreignCurrency.toUpperCase(),
    foreignAmount: row.text(PREPAID_HEADERS.foreignAmount),
    amountRm: used !== "" ? used : topUp,
    mofRef: row.text(PREPAID_HEADERS.mofRef),
    marketingFoc: row
      .text(PREPAID_HEADERS.marketingFoc)
      .toLowerCase()
      .startsWith("y"),
    remarks: row.text(PREPAID_HEADERS.remarks),
  });
  if (parsed.success) ctx.plan.prepaid.push(parsed.data);
  else
    ctx.report(
      sheetName,
      row.number,
      parsed.error.issues[0]?.message ?? "Check the row.",
    );
}
