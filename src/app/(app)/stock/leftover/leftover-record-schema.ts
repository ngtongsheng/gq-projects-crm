import { z } from "zod";
import {
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_UNITS,
} from "@/lib/domain/leftover";

/** An item left over at a site, as entered by hand or pasted from a sheet. */
export const leftoverRecordSchema = z.object({
  mofId: z.uuid({ error: "Could not find that MOF. Reload the page." }),
  item: z
    .string()
    .trim()
    .min(1, "Enter the item.")
    .max(200, "Keep the item under 200 characters."),
  qty: z.coerce
    .number<string>({ error: "Enter the quantity." })
    .positive("Enter a quantity above zero.")
    .max(9_999_999_999, "That quantity is too large."),
  unit: z.enum(LEFTOVER_UNITS, "Choose the unit."),
  condition: z.enum(LEFTOVER_CONDITIONS, "Choose the condition."),
  destination: z.enum(LEFTOVER_DESTINATIONS, "Choose where it goes."),
  note: z
    .string()
    .trim()
    .max(300, "Keep the note under 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});
