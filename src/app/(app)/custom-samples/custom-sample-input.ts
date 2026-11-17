import { z } from "zod";
import { optionalText } from "@/lib/form/form-fields";
import { AttachmentPath } from "@/lib/storage/attachment-rules";

const NOT_FOUND = "Could not find that sample. Reload the page.";
const REQUIRED = "Fill in the design no., design name and received date.";
const GIVE_AWAY_REQUIRED = "Key in who it was given to and the reason.";

/** Record or edit a sample (demo sheetTfRec). The id is chosen before the photo is uploaded under it. */
export const recordSampleSchema = z
  .object({
    id: z.uuid({ error: NOT_FOUND }),
    editing: z.boolean(),
    // Blank: the next TS-### when recording, the code it has when editing.
    code: optionalText(40, "Keep the code under 40 characters."),
    receivedOn: z.iso.date(REQUIRED),
    designName: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(200, "Keep the design name under 200 characters."),
    designNo: z
      .string()
      .trim()
      .min(1, REQUIRED)
      .max(100, "Keep the design no. under 100 characters."),
    supplier: optionalText(200, "Keep the supplier under 200 characters."),
    size: optionalText(100, "Keep the size under 100 characters."),
    qty: z
      .string()
      .trim()
      .transform((value) => (value === "" ? "1" : value))
      .pipe(
        z
          .string()
          .regex(/^[1-9][0-9]{0,5}$/, "Qty must be a whole number, 1 or more."),
      )
      .transform(Number),
    notes: optionalText(1000, "Keep the notes under 1000 characters."),
    photoPath: AttachmentPath.nullable(),
  })
  .refine(
    (form) =>
      form.photoPath === null ||
      form.photoPath.startsWith(`custom-samples/${form.id}/`),
    {
      message: "The photo could not be read. Upload it again.",
      path: ["photoPath"],
    },
  );
export type RecordSampleInput = z.output<typeof recordSampleSchema>;

/** Borrow an available sample (demo sheetTfBorrow). */
export const borrowSampleSchema = z.object({
  sampleId: z.uuid({ error: NOT_FOUND }),
  // Only the MD, who does not sell, picks the salesperson.
  salespersonId: z.uuid().nullable(),
  customer: z
    .string()
    .trim()
    .min(1, "Key in the customer.")
    .max(200, "Keep the customer under 200 characters."),
  project: optionalText(200, "Keep the project under 200 characters."),
  outOn: z.iso.date("Choose the borrow date."),
});

/** Give a sample away (demo sheetTfGift). */
export const giveAwaySampleSchema = z.object({
  sampleId: z.uuid({ error: NOT_FOUND }),
  givenTo: z
    .string()
    .trim()
    .min(1, GIVE_AWAY_REQUIRED)
    .max(200, "Keep the customer under 200 characters."),
  reason: z
    .string()
    .trim()
    .min(5, GIVE_AWAY_REQUIRED)
    .max(500, "Keep the reason under 500 characters."),
});

/** The loan period setting (demo tfCfg); the database allows 1 to 365 whole days. */
export const loanDaysSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9]{1,3}$/,
    "Loan period must be a whole number of days, 1 or more.",
  )
  .transform(Number)
  .pipe(
    z
      .number()
      .min(1, "Loan period must be a whole number of days, 1 or more.")
      .max(365, "Keep the loan period to 365 days or less."),
  );
