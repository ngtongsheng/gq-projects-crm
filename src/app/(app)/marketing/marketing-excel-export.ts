import { Workbook, type Worksheet } from "exceljs";
import { type CalendarDate, formatMonth } from "@/lib/format/date";
import { sumRm } from "@/lib/format/money";
import {
  CATEGORY_HEADER,
  EVENT_COST_HEADERS,
  EVENT_META_LABELS,
  EXPENSE_HEADERS,
  GIVEAWAY_HEADERS,
  PREPAID_HEADERS,
  SHEET,
  VENDOR_HEADERS,
} from "./marketing-excel-layout";
import {
  CURRENCY_LABEL,
  PAYMENT_METHOD_LABEL,
  VENDOR_SKILL_LABEL,
  VENDOR_SUPPLY_LABEL,
} from "./marketing-options";
import type {
  Giveaway,
  MarketingCategory,
  MarketingEvent,
  MarketingExpense,
  MarketingVendor,
  PrepaidEntry,
} from "./marketing-types";

export type MarketingExport = {
  categories: readonly MarketingCategory[];
  expenses: readonly MarketingExpense[];
  events: readonly MarketingEvent[];
  vendors: readonly MarketingVendor[];
  prepaid: readonly PrepaidEntry[];
  giveaways: readonly Giveaway[];
  today: CalendarDate;
};

const DATE_FORMAT = "dd/mm/yyyy";
const MONEY_FORMAT = "#,##0.00";
// Excel's own limit on a sheet name.
const SHEET_NAME_MAX = 31;

// A calendar date as an Excel date (midnight UTC, so it reads back as the same day anywhere).
const excelDate = (date: CalendarDate) => new Date(`${date}T00:00:00Z`);

type Dated = { date: CalendarDate; createdAt: string };

// Oldest first, lines of the same day in the order they were added.
const byDate = (a: Dated, b: Dated) =>
  a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);

/** A sheet name Excel accepts: no \ / ? * [ ] :, at most 31 characters, and not one already used. */
function sheetName(wanted: string, taken: Set<string>): string {
  const clean = wanted.replace(/[\\/?*[\]:]/g, " ").trim() || "Event";
  let name = clean.slice(0, SHEET_NAME_MAX);
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` ${n}`;
    name = clean.slice(0, SHEET_NAME_MAX - suffix.length) + suffix;
  }
  taken.add(name.toLowerCase());
  return name;
}

function addTable(
  sheet: Worksheet,
  headers: readonly string[],
  rows: readonly (readonly (string | number | Date | null)[])[],
  formats: Record<string, string> = {},
) {
  const header = sheet.addRow([...headers]);
  header.font = { bold: true };
  headers.forEach((heading, index) => {
    const column = sheet.getColumn(index + 1);
    column.width = Math.max(14, heading.length + 4);
    if (formats[heading]) column.numFmt = formats[heading];
  });
  for (const row of rows) sheet.addRow([...row]);
}

function addExpenses(
  workbook: Workbook,
  data: MarketingExport,
  taken: Set<string>,
) {
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));
  const h = EXPENSE_HEADERS;
  const sheet = workbook.addWorksheet(sheetName(SHEET.expenses, taken));
  addTable(
    sheet,
    [
      h.date,
      h.category,
      h.event,
      h.description,
      h.vendor,
      h.invoiceRef,
      h.currency,
      h.amount,
      h.amountRm,
      h.paymentMethod,
      h.remarks,
      h.month,
    ],
    data.expenses
      .map((e) => ({ ...e, date: e.spentOn }))
      .sort(byDate)
      .map((e) => [
        excelDate(e.spentOn),
        categoryName.get(e.categoryId) ?? "",
        e.eventName,
        e.description,
        e.vendorName,
        e.invoiceRef,
        CURRENCY_LABEL[e.currency],
        e.amount,
        e.amountRm,
        PAYMENT_METHOD_LABEL[e.paymentMethod],
        e.remarks,
        formatMonth(e.spentOn),
      ]),
    {
      [h.date]: DATE_FORMAT,
      [h.amount]: MONEY_FORMAT,
      [h.amountRm]: MONEY_FORMAT,
    },
  );
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addEvent(
  workbook: Workbook,
  event: MarketingEvent,
  taken: Set<string>,
) {
  const m = EVENT_META_LABELS;
  const h = EVENT_COST_HEADERS;
  const sheet = workbook.addWorksheet(sheetName(event.name, taken));
  // The event's own details sit above the cost table: the sheet name alone would cut a long name.
  const meta: [string, string | number | Date | null][] = [
    [m.name, event.name],
    [m.venue, event.venue],
    [m.startsOn, event.startsOn ? excelDate(event.startsOn) : null],
    [m.endsOn, event.endsOn ? excelDate(event.endsOn) : null],
    [m.budget, event.budget],
    [m.notes, event.notes],
  ];
  for (const line of meta) {
    const row = sheet.addRow(line);
    row.getCell(1).font = { bold: true };
  }
  sheet.getCell(3, 2).numFmt = DATE_FORMAT;
  sheet.getCell(4, 2).numFmt = DATE_FORMAT;
  sheet.getCell(5, 2).numFmt = MONEY_FORMAT;
  sheet.addRow([]);

  addTable(
    sheet,
    [
      h.costGroup,
      h.description,
      h.supplierRef,
      h.foreignAmount,
      h.rate,
      h.unit,
      h.qty,
      h.total,
      h.remarks,
    ],
    event.costs.map((c) => [
      c.costGroup,
      c.description,
      c.supplierRef,
      c.foreignAmount,
      c.rate,
      c.unit,
      c.qty,
      c.total,
      c.remarks,
    ]),
    { [h.rate]: MONEY_FORMAT, [h.total]: MONEY_FORMAT },
  );
  sheet.addRow([
    "Total",
    null,
    null,
    null,
    null,
    null,
    null,
    sumRm(event.costs.map((c) => c.total)),
  ]);
}

function addVendors(
  workbook: Workbook,
  data: MarketingExport,
  taken: Set<string>,
) {
  const year = data.today.slice(0, 4);
  addTable(
    workbook.addWorksheet(sheetName(SHEET.vendors, taken)),
    VENDOR_HEADERS,
    [...data.vendors]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => [
        v.name,
        v.kind === "company" ? "Company" : "Part-timer",
        v.skills.map((s) => VENDOR_SKILL_LABEL[s]).join(", "),
        v.rate,
        v.portfolioUrl,
        v.supplies ? VENDOR_SUPPLY_LABEL[v.supplies] : null,
        v.contactPerson,
        v.phone,
        v.email,
        v.notes,
        sumRm(
          v.payments
            .filter((p) => p.spentOn.startsWith(year))
            .map((p) => p.amountRm),
        ),
      ]),
    { "Vendor total YTD": MONEY_FORMAT },
  );
}

function addPrepaid(
  workbook: Workbook,
  data: MarketingExport,
  taken: Set<string>,
) {
  const h = PREPAID_HEADERS;
  addTable(
    workbook.addWorksheet(sheetName(SHEET.prepaid, taken)),
    [
      h.date,
      h.vendor,
      h.description,
      h.mofRef,
      h.topUp,
      h.used,
      h.marketingFoc,
      h.remarks,
      h.foreignCurrency,
      h.foreignAmount,
    ],
    data.prepaid
      .map((p) => ({ ...p, date: p.entryOn }))
      .sort(byDate)
      .map((p) => [
        excelDate(p.entryOn),
        p.vendorName,
        p.description,
        p.mofRef,
        p.kind === "top_up" ? p.amountRm : null,
        p.kind === "deduction" ? p.amountRm : null,
        p.marketingFoc ? "Yes" : "",
        p.remarks,
        p.foreignCurrency,
        p.foreignAmount,
      ]),
    { [h.date]: DATE_FORMAT, [h.topUp]: MONEY_FORMAT, [h.used]: MONEY_FORMAT },
  );
}

function addGiveaways(
  workbook: Workbook,
  data: MarketingExport,
  taken: Set<string>,
) {
  const h = GIVEAWAY_HEADERS;
  addTable(
    workbook.addWorksheet(sheetName(SHEET.giveaways, taken)),
    [
      h.date,
      h.supplier,
      h.invoiceNo,
      h.item,
      h.givenTo,
      h.qty,
      h.unitCost,
      h.total,
    ],
    data.giveaways
      .map((g) => ({ ...g, date: g.givenOn, createdAt: "" }))
      .sort(byDate)
      .map((g) => [
        excelDate(g.givenOn),
        g.supplier,
        g.invoiceNo,
        g.item,
        g.givenTo,
        g.qty,
        g.unitCost,
        g.total,
      ]),
    {
      [h.date]: DATE_FORMAT,
      [h.unitCost]: MONEY_FORMAT,
      [h.total]: MONEY_FORMAT,
    },
  );
}

/**
 * The marketing workbook (demo mkExport): the expense log, one sheet per event, vendors, prepaid
 * accounts and the give-away register. Beyond the demo it also keeps each event's venue and budget,
 * the category order and the prepaid foreign amounts, so importing the file back loses nothing.
 */
export async function buildMarketingWorkbook(
  data: MarketingExport,
): Promise<ArrayBuffer> {
  const workbook = new Workbook();
  const taken = new Set<string>();
  addExpenses(workbook, data, taken);
  for (const event of data.events) addEvent(workbook, event, taken);
  addVendors(workbook, data, taken);
  addPrepaid(workbook, data, taken);
  addGiveaways(workbook, data, taken);
  addTable(
    workbook.addWorksheet(sheetName(SHEET.categories, taken)),
    [CATEGORY_HEADER],
    data.categories.map((c) => [c.name]),
  );
  return workbook.xlsx.writeBuffer();
}

export const exportFileName = (today: CalendarDate) =>
  `GQ_Marketing_Expense_${today}.xlsx`;
