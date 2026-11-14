import { z } from "zod";
import { optionalText } from "@/lib/form/form-fields";

// Values mirror the result check constraint in the sales calendar migration.
export const VisitResult = z.enum(
  [
    "introduced",
    "presented",
    "sample_requested",
    "quotation_requested",
    "specified",
    "order_confirmed",
    "follow_up_later",
    "not_interested",
  ],
  { error: "Choose the result of the visit." },
);
export type VisitResult = z.infer<typeof VisitResult>;

export const VisitResultLabel: Record<VisitResult, string> = {
  introduced: "Introduced GQ / new contact",
  presented: "Presented products",
  sample_requested: "Sample requested",
  quotation_requested: "Quotation requested",
  specified: "Specified our product",
  order_confirmed: "Order confirmed",
  follow_up_later: "Follow up later",
  not_interested: "Not interested",
};

/** The demo asks for at least one sentence about the company. */
export const MIN_LEARNINGS = 15;

const optionalDate = (message: string) =>
  z.union([z.literal("").transform(() => null), z.iso.date(message)]);

const optionalMonth = z.union([
  z.literal("").transform(() => null),
  z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a valid month for the start."),
]);

export const outcomeFormSchema = z
  .object({
    activityId: z.uuid({
      error: "Could not find that activity. Reload the page.",
    }),
    result: VisitResult,
    learnings: z
      .string()
      .trim()
      .min(
        MIN_LEARNINGS,
        "Write what you learned about the company (at least one sentence).",
      )
      .max(2000, "Keep what you learned under 2000 characters."),
    // The project lead is optional: no name means no lead. Its value is checked as a project.
    leadName: optionalText(200, "Keep the project name under 200 characters."),
    leadValue: z.string().trim(),
    leadStart: optionalMonth,
    nextStep: optionalText(200, "Keep the next step under 200 characters."),
    nextDate: optionalDate("Choose a valid date for the follow-up."),
  })
  .refine((form) => form.nextStep === null || form.nextDate !== null, {
    message: "Choose the follow-up date for the next step.",
    path: ["nextDate"],
  });
export type OutcomeForm = z.infer<typeof outcomeFormSchema>;

/** A planned activity whose time has come needs its outcome logged. */
export const needsOutcome = (
  activity: { status: string; startsAt: string },
  now: Date = new Date(),
) => activity.status === "planned" && new Date(activity.startsAt) <= now;
