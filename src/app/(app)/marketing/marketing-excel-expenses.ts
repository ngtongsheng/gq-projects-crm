import { eventSchema } from "./marketing-event-input";
import { cellDate, type SheetRow } from "./marketing-excel-cells";
import { EXPENSE_HEADERS } from "./marketing-excel-layout";
import type { ImportContext } from "./marketing-excel-plan";
import { expenseSchema } from "./marketing-input";
import {
  CURRENCIES,
  type Currency,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "./marketing-options";

const DEFAULT_CATEGORY = "Others";

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

function eventIdByName(
  ctx: ImportContext,
  sheetName: string,
  row: number,
  name: string,
) {
  if (name === "") return "";
  const found = ctx.events.get(name.toLowerCase());
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
    ctx.report(
      sheetName,
      row,
      check.error.issues[0]?.message ?? "Check the event.",
    );
    return null;
  }
  return ctx.eventFor(check.data.name).id;
}

export function readExpense(
  ctx: ImportContext,
  sheetName: string,
  row: SheetRow,
) {
  const rm = row.text(EXPENSE_HEADERS.amountRm);
  const amount = row.text(EXPENSE_HEADERS.amount);
  const date = cellDate(row.cell(EXPENSE_HEADERS.date));
  if (date === "" && amount === "" && rm === "") return;

  const currency = currencyKey(row.text(EXPENSE_HEADERS.currency));
  const eventId = eventIdByName(
    ctx,
    sheetName,
    row.number,
    row.text(EXPENSE_HEADERS.event),
  );
  if (eventId === null) return;
  const parsed = expenseSchema.safeParse({
    id: "",
    spentOn: date,
    categoryId: ctx.categoryId(
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
  if (parsed.success) ctx.plan.expenses.push(parsed.data);
  else
    ctx.report(
      sheetName,
      row.number,
      parsed.error.issues[0]?.message ?? "Check the row.",
    );
}
