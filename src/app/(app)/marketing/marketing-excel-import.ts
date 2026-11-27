import { Workbook, type Worksheet } from "exceljs";
import {
  cellText,
  findHeaderRow,
  flattenCell,
  isTotalRow,
  readRows,
} from "./marketing-excel-cells";
import { readEventSheet } from "./marketing-excel-events";
import { readExpense } from "./marketing-excel-expenses";
import { readGiveaway } from "./marketing-excel-giveaways";
import {
  CATEGORY_HEADER,
  EVENT_COST_HEADERS,
  EXPENSE_HEADERS,
  GIVEAWAY_HEADERS,
  PREPAID_HEADERS,
  SHEET,
} from "./marketing-excel-layout";
import {
  createImportContext,
  type ImportContext,
  type ImportPlan,
  type KnownRecords,
} from "./marketing-excel-plan";
import { readPrepaid } from "./marketing-excel-prepaid";

const HEADER_FIRST_CELLS = ["date", "cost group"];

/**
 * Reads a marketing workbook (demo 2.8). Sheets are recognised by their heading row, not their
 * name: "Date" and "Cost group" start the lists the demo understands. Every row goes through the
 * same input schemas as the forms; a bad row is reported with its sheet and row number.
 */
export async function parseMarketingWorkbook(
  file: ArrayBuffer,
  known: KnownRecords,
  newId: () => string = () => crypto.randomUUID(),
): Promise<ImportPlan> {
  const workbook = new Workbook();
  await workbook.xlsx.load(file);

  const ctx = createImportContext(known, newId);
  const { plan } = ctx;

  for (const sheet of workbook.worksheets) {
    if (sheet.name.toLowerCase() === SHEET.categories.toLowerCase()) {
      readCategories(ctx, sheet);
      continue;
    }
    const headerRow = findHeaderRow(sheet, HEADER_FIRST_CELLS);
    if (headerRow === null) continue;
    const rows = readRows(sheet, headerRow).filter((row) => !isTotalRow(row));
    const headings = headingsOf(sheet, headerRow);

    if (headings.has(EVENT_COST_HEADERS.costGroup.toLowerCase())) {
      plan.found.events = true;
      readEventSheet(ctx, sheet, headerRow, rows);
    } else if (
      headings.has(EXPENSE_HEADERS.category.toLowerCase()) ||
      headings.has(EXPENSE_HEADERS.event.toLowerCase())
    ) {
      plan.found.expenses = true;
      for (const row of rows) readExpense(ctx, sheet.name, row);
    } else if (
      headings.has(PREPAID_HEADERS.topUp.toLowerCase()) ||
      headings.has(PREPAID_HEADERS.used.toLowerCase())
    ) {
      plan.found.prepaid = true;
      for (const row of rows) readPrepaid(ctx, sheet.name, row);
    } else if (
      headings.has(GIVEAWAY_HEADERS.item.toLowerCase()) ||
      headings.has(GIVEAWAY_HEADERS.givenTo.toLowerCase())
    ) {
      plan.found.giveaways = true;
      for (const row of rows) readGiveaway(ctx, sheet.name, row);
    }
  }

  plan.events = [...ctx.events.values()].filter((e) => e.isNew || e.details);
  return plan;
}

function readCategories(ctx: ImportContext, sheet: Worksheet) {
  const headerRow = findHeaderRow(sheet, [CATEGORY_HEADER.toLowerCase()], 3);
  if (headerRow === null) return;
  for (let n = headerRow + 1; n <= sheet.rowCount; n++) {
    const name = cellText(flattenCell(sheet.getRow(n).getCell(1).value));
    if (name === "") continue;
    if (name.length > 100) {
      ctx.report(
        sheet.name,
        n,
        "Keep each category name under 100 characters.",
      );
      continue;
    }
    ctx.categoryId(name);
  }
}

function headingsOf(sheet: Worksheet, headerRow: number): Set<string> {
  const names = new Set<string>();
  for (let c = 1; c <= sheet.columnCount; c++) {
    const name = cellText(
      flattenCell(sheet.getRow(headerRow).getCell(c).value),
    );
    if (name !== "") names.add(name.toLowerCase());
  }
  return names;
}
