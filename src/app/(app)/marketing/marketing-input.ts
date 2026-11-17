import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";
import { CURRENCIES, PAYMENT_METHODS } from "./marketing-options";

const REQUIRED = "Fill in date, description, vendor and amount.";
const RM_REQUIRED = "Key in the amount in RM.";
const NOT_FOUND = "Could not find that expense. Reload the page.";
// numeric(12,2) holds up to this.
const MAX_AMOUNT = 9_999_999_999.99;

const amountText = (message: string) =>
  z
    .string()
    .transform((text) => parseRm(text))
    .pipe(
      z
        .number({ error: message })
        .positive(message)
        .max(MAX_AMOUNT, "That amount is too large."),
    );

/** Add or edit an expense (demo sheetMkExp). The vendor is typed by name; a new name becomes a vendor. */
export const expenseSchema = z
  .object({
    // Blank when adding.
    id: optionalId(NOT_FOUND),
    spentOn: z.iso.date(REQUIRED),
    categoryId: z.uuid("Choose the category."),
    description: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(300, "Keep the description under 300 characters."),
    vendor: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(200, "Keep the vendor under 200 characters."),
    invoiceRef: optionalText(100, "Keep the invoice no. under 100 characters."),
    currency: z.enum(CURRENCIES),
    amount: amountText(REQUIRED),
    // Only keyed in for a foreign currency.
    amountRm: z.string(),
    eventId: optionalId("Choose the event again."),
    paymentMethod: z.enum(PAYMENT_METHODS),
    remarks: optionalText(1000, "Keep the remarks under 1000 characters."),
  })
  .transform((form, ctx) => {
    if (form.currency === "RM") return { ...form, amountRm: form.amount };
    const amountRm = amountText(RM_REQUIRED).safeParse(form.amountRm);
    if (!amountRm.success) {
      ctx.issues.push({
        code: "custom",
        message: amountRm.error.issues[0]?.message ?? RM_REQUIRED,
        input: form.amountRm,
      });
      return z.NEVER;
    }
    return { ...form, amountRm: amountRm.data };
  });
export type ExpenseInput = z.output<typeof expenseSchema>;

/** The whole category list in its new order (demo sheetMkCats); ids of new rows are chosen by the browser. */
export const categoriesSchema = z
  .array(
    z.object({
      id: z.uuid(),
      name: z
        .string()
        .trim()
        .min(1, "Give every category a name.")
        .max(100, "Keep each category name under 100 characters."),
    }),
  )
  .min(1, "Keep at least one category.")
  .refine(
    (list) =>
      new Set(list.map((category) => category.name.toLowerCase())).size ===
      list.length,
    "Two categories have the same name.",
  );

export const expenseId = z.uuid({ error: NOT_FOUND });
