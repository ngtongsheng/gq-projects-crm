import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";
import { amountText, MAX_AMOUNT, optionalChoice } from "./marketing-input";
import { PREPAID_CURRENCIES, PREPAID_KINDS } from "./marketing-options";

const ENTRY_NOT_FOUND = "Could not find that entry. Reload the page.";
const VENDOR_NOT_FOUND = "Could not find that vendor. Reload the page.";
const REQUIRED = "Fill in date, vendor and the RM amount.";
const CLIENT_PROJECT = "Key in the client – project.";
const ALERT_AMOUNT =
  "The alert must be an amount in RM, or blank to turn it off.";

const optionalForeignAmount = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (text === "") return null;
    const amount = parseRm(text);
    if (amount === null || amount <= 0 || amount > MAX_AMOUNT) {
      ctx.issues.push({
        code: "custom",
        message: "The foreign amount must be more than 0.",
        input: text,
      });
      return z.NEVER;
    }
    return amount;
  });

/**
 * Add or edit a prepaid entry (demo sheetMkPre). The vendor is typed by name; a new name becomes
 * a vendor and so a new account. A deduction names the client and project; only a deduction can
 * be a marketing cost.
 */
export const prepaidEntrySchema = z
  .object({
    // Blank when adding.
    id: optionalId(ENTRY_NOT_FOUND),
    kind: z.enum(PREPAID_KINDS),
    entryOn: z.iso.date(REQUIRED),
    vendor: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(200, "Keep the vendor under 200 characters."),
    description: optionalText(
      300,
      "Keep the description under 300 characters.",
    ),
    foreignCurrency: optionalChoice(PREPAID_CURRENCIES),
    foreignAmount: optionalForeignAmount,
    amountRm: amountText(REQUIRED),
    mofRef: optionalText(100, "Keep the MOF / ref under 100 characters."),
    marketingFoc: z.boolean(),
    remarks: optionalText(1000, "Keep the remarks under 1000 characters."),
  })
  .refine((form) => form.kind === "top_up" || form.description !== null, {
    message: CLIENT_PROJECT,
    path: ["description"],
  })
  .transform((form) => {
    const foreign =
      form.foreignAmount === null
        ? { foreignCurrency: null, foreignAmount: null }
        : {
            foreignCurrency: form.foreignCurrency ?? "EUR",
            foreignAmount: form.foreignAmount,
          };
    return {
      ...form,
      ...foreign,
      marketingFoc: form.kind === "deduction" && form.marketingFoc,
    };
  });
export type PrepaidEntryInput = z.output<typeof prepaidEntrySchema>;

export const prepaidEntryId = z.uuid({ error: ENTRY_NOT_FOUND });

/** The balance below which an account turns red (demo sheetMkPreAlert); blank or 0 turns the alert off. */
export const prepaidAlertSchema = z.object({
  vendorId: z.uuid(VENDOR_NOT_FOUND),
  alert: z
    .string()
    .trim()
    .transform((text) => (text === "" ? 0 : parseRm(text)))
    .pipe(
      z
        .number({ error: ALERT_AMOUNT })
        .min(0, ALERT_AMOUNT)
        .max(MAX_AMOUNT, "That amount is too large."),
    ),
});
