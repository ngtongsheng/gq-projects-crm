import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";
import {
  CURRENCIES,
  PAYMENT_METHODS,
  VENDOR_KINDS,
  VENDOR_SKILLS,
  VENDOR_SUPPLIES,
} from "./marketing-options";

const REQUIRED = "Fill in date, description, vendor and amount.";
const RM_REQUIRED = "Key in the amount in RM.";
const NOT_FOUND = "Could not find that expense. Reload the page.";
// numeric(12,2) holds up to this.
export const MAX_AMOUNT = 9_999_999_999.99;

export const amountText = (message: string) =>
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

const VENDOR_NOT_FOUND = "Could not find that vendor. Reload the page.";
const NAME_REQUIRED = "Fill in the name.";
const NEEDS_CONTACT = "A part-timer needs a phone number or an email.";

export const optionalChoice = <T extends readonly [string, ...string[]]>(
  values: T,
) =>
  z
    .union([z.literal(""), z.enum(values)])
    .transform((value) => (value === "" ? null : value));

// A link typed without https:// still opens: the database only takes full addresses.
const portfolioLink = optionalText(500, "Keep the link under 500 characters.")
  .transform((value) =>
    value && !/^https?:\/\//i.test(value) ? `https://${value}` : value,
  )
  .refine(
    (value) => value === null || URL.canParse(value),
    "The portfolio link is not a web address.",
  );

const emailAddress = optionalText(
  200,
  "Keep the email under 200 characters.",
).refine(
  (value) => value === null || /^[^@\s]+@[^@\s]+$/.test(value),
  "The email is not valid.",
);

/**
 * Add or edit a vendor (demo sheetMkVend). A company keeps what it supplies and its contact
 * person; a part-timer keeps skills, rate and portfolio. The other kind's fields are dropped.
 */
export const vendorSchema = z
  .object({
    // Blank when adding.
    id: optionalId(VENDOR_NOT_FOUND),
    kind: z.enum(VENDOR_KINDS),
    name: z
      .string()
      .trim()
      .min(1, NAME_REQUIRED)
      .max(200, "Keep the name under 200 characters."),
    supplies: optionalChoice(VENDOR_SUPPLIES),
    contactPerson: optionalText(
      200,
      "Keep the contact person under 200 characters.",
    ),
    skills: z.array(z.enum(VENDOR_SKILLS)),
    rate: optionalText(200, "Keep the rate under 200 characters."),
    portfolioUrl: portfolioLink,
    phone: optionalText(40, "Keep the phone number under 40 characters."),
    email: emailAddress,
    notes: optionalText(1000, "Keep the notes under 1000 characters."),
  })
  .refine(
    (form) =>
      form.kind === "company" || form.phone !== null || form.email !== null,
    { message: NEEDS_CONTACT, path: ["phone"] },
  )
  .transform((form) =>
    form.kind === "company"
      ? { ...form, skills: [], rate: null, portfolioUrl: null }
      : { ...form, supplies: null, contactPerson: null },
  );
export type VendorInput = z.output<typeof vendorSchema>;

export const vendorId = z.uuid({ error: VENDOR_NOT_FOUND });
