import { z } from "zod";
import {
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_UNITS,
} from "@/lib/domain/leftover";
import { positiveQuantity } from "../quantity-fields";

/** An item left over at a site, as entered by hand or pasted from a sheet. */
export const leftoverRecordSchema = z.object({
  mofId: z.uuid({ error: "Could not find that MOF. Reload the page." }),
  item: z
    .string()
    .trim()
    .min(1, "Enter the item.")
    .max(200, "Keep the item under 200 characters."),
  qty: positiveQuantity,
  unit: z.enum(LEFTOVER_UNITS, "Choose the unit."),
  condition: z.enum(LEFTOVER_CONDITIONS, "Choose the condition."),
  destination: z.enum(LEFTOVER_DESTINATIONS, "Choose where it goes."),
  note: z
    .string()
    .trim()
    .max(300, "Keep the note under 300 characters.")
    .transform((value) => (value === "" ? null : value)),
});
