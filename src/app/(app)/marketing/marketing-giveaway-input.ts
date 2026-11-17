import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";
import { MAX_AMOUNT } from "./marketing-input";

const NOT_FOUND = "Could not find that give-away. Reload the page.";
const REQUIRED = "Fill in date, item and who it was given to.";
const QTY = "The quantity must be a whole number above 0.";

/** Add or edit a give-away line (demo sheetMkGive). Quantity defaults to 1 and unit cost to 0; the total is worked out by the database. */
export const giveawaySchema = z.object({
  // Blank when adding.
  id: optionalId(NOT_FOUND),
  givenOn: z.iso.date(REQUIRED),
  supplier: optionalText(200, "Keep the supplier under 200 characters."),
  invoiceNo: optionalText(100, "Keep the invoice no. under 100 characters."),
  item: z
    .string()
    .trim()
    .min(1, REQUIRED)
    .max(300, "Keep the item under 300 characters."),
  givenTo: z
    .string()
    .trim()
    .min(1, REQUIRED)
    .max(200, "Keep the client / project under 200 characters."),
  qty: z
    .string()
    .trim()
    .transform((text) => (text === "" ? 1 : Number(text)))
    .pipe(
      z
        .number({ error: QTY })
        .int(QTY)
        .positive(QTY)
        .max(2_147_483_647, "That quantity is too large."),
    ),
  unitCost: z
    .string()
    .trim()
    .transform((text) => (text === "" ? 0 : parseRm(text)))
    .pipe(
      z
        .number({ error: "The unit cost must be an amount in RM." })
        .min(0, "The unit cost must be an amount in RM.")
        .max(MAX_AMOUNT, "That unit cost is too large."),
    ),
});
export type GiveawayInput = z.output<typeof giveawaySchema>;

export const giveawayId = z.uuid({ error: NOT_FOUND });
