import { z } from "zod";
import { parseMytInput } from "./activity-time";

// Values mirror the check constraints in the activities migration.
export const ActivityType = z.enum([
  "visit",
  "site_visit",
  "walk_in",
  "call",
  "online_meeting",
]);
export type ActivityType = z.infer<typeof ActivityType>;

export const ActivityTypeLabel: Record<ActivityType, string> = {
  visit: "Visit",
  site_visit: "Site visit",
  walk_in: "Walk-in (showroom)",
  call: "Call",
  online_meeting: "Online meeting",
};

export const ActivityStatus = z.enum(["planned", "completed", "cancelled"]);
export type ActivityStatus = z.infer<typeof ActivityStatus>;

export const ActivityStatusLabel: Record<ActivityStatus, string> = {
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
};

const startsAt = z
  .string()
  .transform((value) => parseMytInput(value))
  .pipe(z.date("Choose the date and time."));

export const activityFormSchema = z
  .object({
    contactId: z.uuid({
      error: "Could not find that customer. Reload the page.",
    }),
    type: ActivityType,
    purpose: z
      .string()
      .trim()
      .min(1, "Enter the purpose.")
      .max(200, "Keep the purpose under 200 characters."),
    outcome: z
      .string()
      .trim()
      .max(2000, "Keep the outcome under 2000 characters.")
      .transform((value) => (value === "" ? null : value)),
    startsAt,
    status: ActivityStatus,
  })
  .refine(
    (form) => form.status !== "completed" || form.startsAt <= new Date(),
    {
      message: "A completed activity can't be in the future.",
      path: ["startsAt"],
    },
  );
export type ActivityForm = z.infer<typeof activityFormSchema>;

export const activityIdSchema = z.uuid({
  error: "Could not find that activity. Reload the page.",
});
