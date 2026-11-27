import { dividedText } from "./marketing-excel-amounts";
import { cellDate, type SheetRow } from "./marketing-excel-cells";
import { GIVEAWAY_HEADERS } from "./marketing-excel-layout";
import type { ImportContext } from "./marketing-excel-plan";
import { giveawaySchema } from "./marketing-giveaway-input";

export function readGiveaway(
  ctx: ImportContext,
  sheetName: string,
  row: SheetRow,
) {
  const date = cellDate(row.cell(GIVEAWAY_HEADERS.date));
  const item = row.text(GIVEAWAY_HEADERS.item);
  const total = row.text(GIVEAWAY_HEADERS.total);
  if (date === "" && item === "" && total === "") return;
  const qty = row.text(GIVEAWAY_HEADERS.qty);
  const parsed = giveawaySchema.safeParse({
    id: "",
    givenOn: date,
    supplier: row.text(GIVEAWAY_HEADERS.supplier),
    invoiceNo: row.text(GIVEAWAY_HEADERS.invoiceNo),
    item,
    givenTo: row.text(GIVEAWAY_HEADERS.givenTo),
    qty,
    unitCost: row.text(GIVEAWAY_HEADERS.unitCost) || dividedText(total, qty),
  });
  if (parsed.success) ctx.plan.giveaways.push(parsed.data);
  else
    ctx.report(
      sheetName,
      row.number,
      parsed.error.issues[0]?.message ?? "Check the row.",
    );
}
