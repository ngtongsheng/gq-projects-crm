import { z } from "zod";
import {
  PICKUP_MAX_LINES,
  PICKUP_METHODS,
  SAMPLE_UNITS,
} from "@/lib/domain/samples";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { onHandQuantity, positiveQuantity } from "../stock/quantity-fields";

/** A sample as entered by hand or pasted from a sheet. The quantity is what is at Best Link. */
export const sampleSchema = z
  .object({
    product: z
      .string()
      .trim()
      .min(1, "Choose the product.")
      .max(60, "Keep the product under 60 characters."),
    brand: optionalText(120, "Keep the brand under 120 characters."),
    // The database keeps SKUs upper case, so "xch-03" and "XCH-03" are one line.
    sku: z
      .string()
      .trim()
      .max(60, "Keep the SKU under 60 characters.")
      .transform((value) => (value === "" ? null : value.toUpperCase())),
    name: optionalText(200, "Keep the product name under 200 characters."),
    qty: onHandQuantity,
    unit: z.enum(SAMPLE_UNITS, "Choose the unit."),
    spec: optionalText(120, "Keep the size under 120 characters."),
    notes: optionalText(300, "Keep the notes under 300 characters."),
  })
  .refine((sample) => sample.sku !== null || sample.name !== null, {
    message: "Key in the SKU or the product name.",
    path: ["name"],
  });

export type SampleInput = z.output<typeof sampleSchema>;

/** Taking a sample out of Best Link: for a while, or for good when the client keeps it. */
export const takeOutSchema = z.object({
  sampleId: z.uuid({ error: "Could not find that sample. Reload the page." }),
  qty: positiveQuantity,
  takenBy: z.uuid({ error: "Choose who takes it." }),
  forWhom: optionalText(
    200,
    "Keep the client or project under 200 characters.",
  ),
  clientKeeps: z.boolean(),
});

const pickupLineSchema = z.object({
  // The sample this row takes out of Best Link, when it names one in the list.
  sampleId: z.uuid().nullable(),
  productName: z
    .string()
    .trim()
    .min(1, "Key in the product name on every row.")
    .max(120, "Keep each product name under 120 characters."),
  spec: optionalText(120, "Keep each specification under 120 characters."),
  qty: positiveQuantity,
  unit: z.enum(SAMPLE_UNITS, "Choose the unit on every row."),
  remarks: optionalText(120, "Keep each remark under 120 characters."),
});

/** A Best Link pickup form as the page posts it. */
export const pickupFormSchema = z.object({
  personInCharge: z
    .string()
    .trim()
    .min(1, "Fill in the person in charge.")
    .max(120, "Keep the person in charge under 120 characters."),
  contact: z
    .string()
    .trim()
    .min(1, "Fill in the contact number.")
    .max(60, "Keep the contact under 60 characters."),
  method: z.enum(PICKUP_METHODS, "Choose the delivery method."),
  appointmentOn: z.iso.date("Choose the appointment date."),
  driverContact: optionalText(
    60,
    "Keep the driver contact under 60 characters.",
  ),
  vehicleNo: optionalText(30, "Keep the vehicle no. under 30 characters."),
  address: optionalText(300, "Keep the address under 300 characters."),
  takenBy: optionalId("Choose who takes the samples."),
  forWhom: optionalText(
    200,
    "Keep the client or project under 200 characters.",
  ),
  lines: z
    .array(pickupLineSchema)
    .min(1, "Add at least one item.")
    .max(
      PICKUP_MAX_LINES,
      `A pickup form takes at most ${PICKUP_MAX_LINES} rows.`,
    ),
});

export type PickupFormInput = z.output<typeof pickupFormSchema>;
