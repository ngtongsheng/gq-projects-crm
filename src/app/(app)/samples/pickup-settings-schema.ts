import { z } from "zod";
import { optionalText } from "@/lib/form/form-fields";

/**
 * Best Link's WhatsApp number as people type it ("012-3723925", "+60 12-372 3925") to the
 * digits with country code that wa.me needs. A leading 0 is Malaysian.
 */
const whatsAppNumber = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const digits = value.replace(/\D/g, "");
    const international = digits.startsWith("0") ? `6${digits}` : digits;
    if (!/^[0-9]{8,15}$/.test(international)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Key in the WhatsApp number with digits only, e.g. 012-3723925.",
      });
      return z.NEVER;
    }
    return international;
  });

const driveFolderUrl = optionalText(
  500,
  "Keep the link under 500 characters.",
).pipe(
  z
    .string()
    .regex(/^https:\/\/\S+$/, "Paste the full link starting with https://")
    .nullable(),
);

export const pickupSettingsSchema = z.object({
  bestLinkWhatsapp: whatsAppNumber,
  driveFolderUrl,
});

export const nextPickupNumberSchema = z.object({
  nextNo: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, "Key in the form number as digits, e.g. 25.")
    .transform(Number)
    .pipe(z.number().min(1, "The number must be 1 or more.")),
});
