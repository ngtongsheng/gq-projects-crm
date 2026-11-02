import { z } from "zod";
import { STOCK_UNITS } from "@/lib/domain/reservation";

/** A stock item as entered by hand or pasted from a sheet. */
export const stockItemSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "Enter the SKU.")
    .max(60, "Keep the SKU under 60 characters."),
  supplier: z
    .string()
    .trim()
    .min(1, "Enter the supplier.")
    .max(120, "Keep the supplier under 120 characters."),
  collection: z
    .string()
    .trim()
    .max(120, "Keep the collection under 120 characters.")
    .transform((value) => (value === "" ? null : value)),
  qty: z.coerce
    .number<string>({ error: "Enter the quantity." })
    .min(0, "The quantity cannot be negative.")
    .max(9_999_999_999, "That quantity is too large."),
  unit: z.enum(STOCK_UNITS, "Choose the unit."),
});
