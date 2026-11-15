import { z } from "zod";
import { ALLOWANCE_TYPES } from "@/lib/domain/staff-package";

/** Mirrors is_allowance_list() in the database: at most 20, each RM 0.01 to RM 100,000. */
export const allowanceListForm = z
  .array(
    z.object({
      name: z.enum(ALLOWANCE_TYPES, { error: "Choose the allowance type." }),
      amount: z
        .number({ error: "Key in each allowance amount." })
        .min(0.01, "Key in each allowance amount.")
        .max(100000, "An allowance can be at most RM 100,000."),
    }),
  )
  .max(20, "Keep it to 20 allowances.");

/** An amount of money, or null when left blank. */
export const claimCapForm = z
  .number({ error: "Key in the claim cap as a number." })
  .min(0, "The claim cap can't be below zero.")
  .max(99999999, "That claim cap is too large.")
  .nullable();

export const httpsLinkForm = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(500, "Keep the link under 500 characters.")
    .regex(/^https:\/\/\S+$/, "Paste the full https:// link."),
]);
