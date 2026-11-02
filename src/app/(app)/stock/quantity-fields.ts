import { z } from "zod";
import { roundQuantity } from "@/lib/format/quantity";

const MAX_QUANTITY = 9_999_999_999;

// Rounded before it is checked, because the database keeps 2 decimals: 0.004 must be refused
// here as zero, and a pasted 2.135 must match the 2.14 it is saved as.
// A blank must not read as zero and empty the shelf.
const roundedQuantity = z
  .string()
  .trim()
  .min(1, "Enter the quantity.")
  .pipe(z.coerce.number<string>({ error: "Enter the quantity." }))
  .transform(roundQuantity);

/** A quantity that must be above zero: a hold, or an item left over at a site. */
export const positiveQuantity = roundedQuantity.pipe(
  z
    .number()
    .positive("Enter a quantity above zero.")
    .max(MAX_QUANTITY, "That quantity is too large."),
);

/** What is on the shelf; zero is allowed. */
export const onHandQuantity = roundedQuantity.pipe(
  z
    .number()
    .min(0, "The quantity cannot be negative.")
    .max(MAX_QUANTITY, "That quantity is too large."),
);
