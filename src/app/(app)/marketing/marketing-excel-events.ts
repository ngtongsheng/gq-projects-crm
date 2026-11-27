import type { Worksheet } from "exceljs";
import { eventCostSchema, eventSchema } from "./marketing-event-input";
import { dividedText } from "./marketing-excel-amounts";
import {
  type Cell,
  cellDate,
  cellText,
  flattenCell,
  type SheetRow,
} from "./marketing-excel-cells";
import {
  EVENT_COST_HEADERS,
  EVENT_META_LABELS,
} from "./marketing-excel-layout";
import type { ImportContext } from "./marketing-excel-plan";

/** The label and value lines above an event sheet's cost table, as form text. */
function readEventMeta(sheet: Worksheet, headerRow: number) {
  const value = (cell: Cell, asDate = false) =>
    asDate ? cellDate(cell) : cellText(cell);
  const lines = new Map<string, Cell>();
  for (let n = 1; n < headerRow; n++) {
    const row = sheet.getRow(n);
    const label = cellText(flattenCell(row.getCell(1).value)).toLowerCase();
    if (label !== "") lines.set(label, flattenCell(row.getCell(2).value));
  }
  const line = (label: string, asDate = false) =>
    value(lines.get(label.toLowerCase()) ?? null, asDate);
  return {
    present: lines.size > 0,
    name: line(EVENT_META_LABELS.name),
    venue: line(EVENT_META_LABELS.venue),
    startsOn: line(EVENT_META_LABELS.startsOn, true),
    endsOn: line(EVENT_META_LABELS.endsOn, true),
    budget: line(EVENT_META_LABELS.budget),
    notes: line(EVENT_META_LABELS.notes),
  };
}

export function readEventSheet(
  ctx: ImportContext,
  sheet: Worksheet,
  headerRow: number,
  rows: SheetRow[],
) {
  const meta = readEventMeta(sheet, headerRow);
  const name = meta.name || sheet.name;
  const check = eventSchema.safeParse({
    id: "",
    name,
    startsOn: meta.startsOn,
    endsOn: meta.endsOn,
    venue: meta.venue,
    budget: meta.budget,
    notes: meta.notes,
  });
  if (!check.success) {
    ctx.report(
      sheet.name,
      null,
      check.error.issues[0]?.message ?? "Check the event.",
    );
    return;
  }
  const event = ctx.eventFor(check.data.name);
  // The sheet's own block replaces the event's details; a demo sheet has none and leaves them be.
  if (meta.present) {
    event.details = {
      startsOn: check.data.startsOn,
      endsOn: check.data.endsOn,
      venue: check.data.venue,
      budget: check.data.budget,
      notes: check.data.notes,
    };
  }

  for (const row of rows) {
    const group = row.text(EVENT_COST_HEADERS.costGroup);
    const total = row.text(EVENT_COST_HEADERS.total);
    const rate = row.text(EVENT_COST_HEADERS.rate);
    const qty = row.text(EVENT_COST_HEADERS.qty);
    if (group === "" || (total === "" && rate === "")) continue;
    const parsed = eventCostSchema.safeParse({
      id: "",
      eventId: event.id,
      costGroup: group,
      description: row.text(EVENT_COST_HEADERS.description),
      supplierRef: row.text(EVENT_COST_HEADERS.supplierRef),
      foreignAmount: row.text(EVENT_COST_HEADERS.foreignAmount),
      rate: rate || dividedText(total, qty),
      unit: row.text(EVENT_COST_HEADERS.unit),
      qty,
      remarks: row.text(EVENT_COST_HEADERS.remarks),
    });
    if (parsed.success) ctx.plan.costs.push(parsed.data);
    else
      ctx.report(
        sheet.name,
        row.number,
        parsed.error.issues[0]?.message ?? "Check the row.",
      );
  }
}
