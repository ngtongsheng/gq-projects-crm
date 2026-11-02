import { z } from "zod";

/** A text field from a posted form; a missing field or a file reads as "". */
export const textField = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Trimmed text up to `max` characters; blank is saved as null. */
export const optionalText = (
  max: number,
  message = `Keep this under ${max} characters.`,
) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

/** A picked record id, or null when nothing was picked (""). */
export const optionalId = (message?: string) =>
  z
    .union([z.literal(""), z.uuid({ error: message })])
    .transform((value) => (value === "" ? null : value));
