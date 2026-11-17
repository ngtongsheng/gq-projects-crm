import { Workbook, type Worksheet } from "exceljs";
import { parseRm } from "@/lib/format/money";
import {
  type EventCostInput,
  type EventInput,
  eventCostSchema,
  eventSchema,
} from "./marketing-event-input";
import {
  type Cell,
  cellDate,
  cellText,
  findHeaderRow,
  flattenCell,
  isTotalRow,
  readRows,
  type SheetRow,
} from "./marketing-excel-cells";
import {
  CATEGORY_HEADER,
  EVENT_COST_HEADERS,
  EVENT_META_LABELS,
  EXPENSE_HEADERS,
  GIVEAWAY_HEADERS,
  PREPAID_HEADERS,
  SHEET,
} from "./marketing-excel-layout";
import { type GiveawayInput, giveawaySchema } from "./marketing-giveaway-input";
import { type ExpenseInput, expenseSchema } from "./marketing-input";
import {
  CURRENCIES,
  type Currency,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "./marketing-options";
import {
  type PrepaidEntryInput,
  prepaidEntrySchema,
} from "./marketing-prepaid-input";

const HEADER_FIRST_CELLS = ["date", "cost group"];
const DEFAULT_CATEGORY = "Others";

export type KnownRecords = {
  categories: readonly { id: string; name: string }[];
  events: readonly { id: string; name: string }[];
};

type EventDetails = Pick<
  EventInput,
  "startsOn" | "endsOn" | "venue" | "budget" | "notes"
>;

/** An event the file names: one already in the app, or one to add. `details` is set when the file has the event's own sheet block. */
export type PlannedEvent = {
  id: string;
  name: string;
  isNew: boolean;
  details: EventDetails | null;
};

/** What reading the file found, validated like the forms. Nothing is saved until `errors` is empty. */
export type ImportPlan = {
  newCategories: { id: string; name: string }[];
  /** Only events to add or to change; ones the file merely mentions are left out. */
  events: PlannedEvent[];
  costs: EventCostInput[];
  expenses: ExpenseInput[];
  prepaid: PrepaidEntryInput[];
  giveaways: GiveawayInput[];
  /** Which kinds of sheet the file has, so a replace only clears what the file brings back. */
  found: {
    expenses: boolean;
    events: boolean;
    prepaid: boolean;
    giveaways: boolean;
  };
  errors: ImportProblem[];
};

/** A row (or a whole sheet, when `row` is null) that cannot be imported, with the form's own message. */
export type ImportProblem = {
  sheet: string;
  row: number | null;
  message: string;
};

const currencyKey = (text: string): Currency => {
  const wanted = text.toLowerCase();
  if (wanted === "") return "RM";
  return CURRENCIES.find((key) => key.toLowerCase() === wanted) ?? "other";
};

const paymentKey = (text: string): PaymentMethod => {
  const wanted = text.toLowerCase();
  if (wanted === "") return "bank_transfer";
  return (
    PAYMENT_METHODS.find(
      (key) =>
        key === wanted || PAYMENT_METHOD_LABEL[key].toLowerCase() === wanted,
    ) ?? "others"
  );
};

// A cell like "RM 12.50" or "1,200" as a number; null when it is not an amount.
const amountOf = (text: string) => (text === "" ? null : parseRm(text));

// Money worked out from a total and a count, for files that only have the total.
const dividedText = (totalText: string, count: string) => {
  const total = amountOf(totalText);
  const divisor = count === "" ? 1 : parseRm(count);
  if (total === null || divisor === null || divisor <= 0) return "";
  return String(total / divisor);
};

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

  const plan: ImportPlan = {
    newCategories: [],
    events: [],
    costs: [],
    expenses: [],
    prepaid: [],
    giveaways: [],
    found: { expenses: false, events: false, prepaid: false, giveaways: false },
    errors: [],
  };

  const categoryIds = new Map(
    known.categories.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const categoryId = (name: string) => {
    const key = name.toLowerCase();
    const found = categoryIds.get(key);
    if (found) return found;
    const id = newId();
    categoryIds.set(key, id);
    plan.newCategories.push({ id, name });
    return id;
  };

  const events = new Map<string, PlannedEvent>(
    known.events.map((e) => [
      e.name.toLowerCase(),
      { id: e.id, name: e.name, isNew: false, details: null },
    ]),
  );
  const eventFor = (name: string): PlannedEvent => {
    const key = name.toLowerCase();
    const found = events.get(key);
    if (found) return found;
    const added: PlannedEvent = {
      id: newId(),
      name,
      isNew: true,
      details: null,
    };
    events.set(key, added);
    return added;
  };

  const report = (sheet: string, row: number | null, message: string) =>
    plan.errors.push({ sheet, row, message });

  for (const sheet of workbook.worksheets) {
    if (sheet.name.toLowerCase() === SHEET.categories.toLowerCase()) {
      readCategories(sheet);
      continue;
    }
    const headerRow = findHeaderRow(sheet, HEADER_FIRST_CELLS);
    if (headerRow === null) continue;
    const rows = readRows(sheet, headerRow).filter((row) => !isTotalRow(row));
    const headings = headingsOf(sheet, headerRow);

    if (headings.has(EVENT_COST_HEADERS.costGroup.toLowerCase())) {
      plan.found.events = true;
      readEventSheet(sheet, headerRow, rows);
    } else if (
      headings.has(EXPENSE_HEADERS.category.toLowerCase()) ||
      headings.has(EXPENSE_HEADERS.event.toLowerCase())
    ) {
      plan.found.expenses = true;
      for (const row of rows) readExpense(sheet.name, row);
    } else if (
      headings.has(PREPAID_HEADERS.topUp.toLowerCase()) ||
      headings.has(PREPAID_HEADERS.used.toLowerCase())
    ) {
      plan.found.prepaid = true;
      for (const row of rows) readPrepaid(sheet.name, row);
    } else if (
      headings.has(GIVEAWAY_HEADERS.item.toLowerCase()) ||
      headings.has(GIVEAWAY_HEADERS.givenTo.toLowerCase())
    ) {
      plan.found.giveaways = true;
      for (const row of rows) readGiveaway(sheet.name, row);
    }
  }

  plan.events = [...events.values()].filter((e) => e.isNew || e.details);
  return plan;

  function readCategories(sheet: Worksheet) {
    const headerRow = findHeaderRow(sheet, [CATEGORY_HEADER.toLowerCase()], 3);
    if (headerRow === null) return;
    for (let n = headerRow + 1; n <= sheet.rowCount; n++) {
      const name = cellText(flattenCell(sheet.getRow(n).getCell(1).value));
      if (name === "") continue;
      if (name.length > 100) {
        report(sheet.name, n, "Keep each category name under 100 characters.");
        continue;
      }
      categoryId(name);
    }
  }

  function eventIdByName(sheetName: string, row: number, name: string) {
    if (name === "") return "";
    const found = events.get(name.toLowerCase());
    if (found) return found.id;
    const check = eventSchema.safeParse({
      id: "",
      name,
      startsOn: "",
      endsOn: "",
      venue: "",
      budget: "",
      notes: "",
    });
    if (!check.success) {
      report(
        sheetName,
        row,
        check.error.issues[0]?.message ?? "Check the event.",
      );
      return null;
    }
    return eventFor(check.data.name).id;
  }

  function readExpense(sheetName: string, row: SheetRow) {
    const rm = row.text(EXPENSE_HEADERS.amountRm);
    const amount = row.text(EXPENSE_HEADERS.amount);
    const date = cellDate(row.cell(EXPENSE_HEADERS.date));
    if (date === "" && amount === "" && rm === "") return;

    const currency = currencyKey(row.text(EXPENSE_HEADERS.currency));
    const eventId = eventIdByName(
      sheetName,
      row.number,
      row.text(EXPENSE_HEADERS.event),
    );
    if (eventId === null) return;
    const parsed = expenseSchema.safeParse({
      id: "",
      spentOn: date,
      categoryId: categoryId(
        row.text(EXPENSE_HEADERS.category) || DEFAULT_CATEGORY,
      ),
      description: row.text(EXPENSE_HEADERS.description),
      vendor: row.text(EXPENSE_HEADERS.vendor),
      invoiceRef: row.text(EXPENSE_HEADERS.invoiceRef),
      currency,
      // For RM the one amount may sit in either column.
      amount: currency === "RM" ? amount || rm : amount,
      amountRm: rm,
      eventId,
      paymentMethod: paymentKey(row.text(EXPENSE_HEADERS.paymentMethod)),
      remarks: row.text(EXPENSE_HEADERS.remarks),
    });
    if (parsed.success) plan.expenses.push(parsed.data);
    else
      report(
        sheetName,
        row.number,
        parsed.error.issues[0]?.message ?? "Check the row.",
      );
  }

  function readPrepaid(sheetName: string, row: SheetRow) {
    const topUp = row.text(PREPAID_HEADERS.topUp);
    const used = row.text(PREPAID_HEADERS.used);
    const date = cellDate(row.cell(PREPAID_HEADERS.date));
    if (date === "" && topUp === "" && used === "") return;
    if (topUp !== "" && used !== "") {
      report(
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
    if (parsed.success) plan.prepaid.push(parsed.data);
    else
      report(
        sheetName,
        row.number,
        parsed.error.issues[0]?.message ?? "Check the row.",
      );
  }

  function readGiveaway(sheetName: string, row: SheetRow) {
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
    if (parsed.success) plan.giveaways.push(parsed.data);
    else
      report(
        sheetName,
        row.number,
        parsed.error.issues[0]?.message ?? "Check the row.",
      );
  }

  function readEventSheet(
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
      report(
        sheet.name,
        null,
        check.error.issues[0]?.message ?? "Check the event.",
      );
      return;
    }
    const event = eventFor(check.data.name);
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
      if (parsed.success) plan.costs.push(parsed.data);
      else
        report(
          sheet.name,
          row.number,
          parsed.error.issues[0]?.message ?? "Check the row.",
        );
    }
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
