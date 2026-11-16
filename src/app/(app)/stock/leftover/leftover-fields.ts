import { z } from "zod";
import {
  LEFTOVER_KEEP_REASONS,
  LEFTOVER_RETURN_METHODS,
} from "@/lib/domain/leftover";
import { optionalId, optionalText } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";

/** An RM amount typed by hand; blank is saved as null. */
export const optionalRmAmount = (message: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const amount = parseRm(value);
      if (amount === null || amount < 0 || amount > 999_999_999_999) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return amount;
    });

/** A choice from a list, or "" when nothing is chosen (saved as null). */
const optionalChoice = <const Values extends readonly [string, ...string[]]>(
  values: Values,
  message: string,
) =>
  z
    .union([z.literal(""), z.enum(values, message)])
    .transform((value) => (value === "" ? null : value));

export const returnMethodField = optionalChoice(
  LEFTOVER_RETURN_METHODS,
  "Choose how it goes back.",
);

export const keepReasonField = optionalChoice(
  LEFTOVER_KEEP_REASONS,
  "Choose why GQ keeps it.",
);

export const orderedWrongByField = optionalId("Choose the salesperson.");

/** Who takes it back, when, to where and at what cost (the office arranges Lalamove or a lorry). */
export const transportFields = {
  transportBy: optionalText(60, "Keep the transport name under 60 characters."),
  transportOn: z
    .union([z.literal(""), z.iso.date("Enter the pickup date.")])
    .transform((value) => (value === "" ? null : value)),
  transportTo: optionalText(100, "Keep where it goes under 100 characters."),
  transportCost: optionalRmAmount(
    "Enter the transport cost as a number, e.g. 45.00.",
  ),
};
