import { z } from "zod";

export const ownershipRequestSchema = z.object({
  contactId: z.uuid({
    error: "Could not find that customer. Reload the page.",
  }),
  reason: z
    .string()
    .trim()
    .min(1, "Add a reason so the director can decide.")
    .max(500, "Keep the reason under 500 characters."),
});

export const reassignSchema = z
  .object({
    contactId: z.uuid({
      error: "Could not find that customer. Reload the page.",
    }),
    ownerIds: z
      .array(z.uuid({ error: "Choose the new owner." }))
      .min(1, "Choose the new owner.")
      .max(2, "A customer can have at most two owners."),
    wholeCompany: z.boolean(),
    reason: z
      .string()
      .trim()
      .min(1, "Add the reason for the change.")
      .max(500, "Keep the reason under 500 characters."),
  })
  .refine((value) => new Set(value.ownerIds).size === value.ownerIds.length, {
    message: "Choose two different people, or only one.",
    path: ["ownerIds"],
  });

export const ownershipDecisionSchema = z.object({
  requestId: z.uuid({ error: "Could not find that request. Reload the page." }),
  approve: z.boolean(),
});
