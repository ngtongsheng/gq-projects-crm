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

export const ownershipDecisionSchema = z.object({
  requestId: z.uuid({ error: "Could not find that request. Reload the page." }),
  approve: z.boolean(),
});
