import { z } from "zod";
import { parseRm } from "@/lib/format/money";
import { roundQuantity } from "@/lib/format/quantity";
import { AccountType } from "../customers/schemas";

// Values mirror the check constraints in the projects migration.
export const ProjectStage = z.enum([
  "lead",
  "quotation_sent",
  "sample_mockup",
  "follow_up",
  "negotiation",
  "awarded",
  "lost",
  "on_hold",
]);
export type ProjectStage = z.infer<typeof ProjectStage>;

export const ProjectStageLabel: Record<ProjectStage, string> = {
  lead: "Lead / Enquiry",
  quotation_sent: "Quotation Sent",
  sample_mockup: "Sample / Mock-up",
  follow_up: "Follow-up",
  negotiation: "Negotiation",
  awarded: "Awarded",
  lost: "Lost",
  on_hold: "On Hold",
};

/** Stages where the deal is still being chased. */
export const OPEN_STAGES: readonly ProjectStage[] = [
  "lead",
  "quotation_sent",
  "sample_mockup",
  "follow_up",
  "negotiation",
];

export const LeadSource = z.enum(
  [
    "archidex",
    "social_media",
    "website_google",
    "walk_in_showroom",
    "referral",
    "id_architect",
    "developer_main_contractor",
    "tender_portal",
    "existing_customer",
    "exhibition_event",
    "cold_call",
  ],
  { error: "Choose where the lead came from." },
);
export type LeadSource = z.infer<typeof LeadSource>;

export const LeadSourceLabel: Record<LeadSource, string> = {
  archidex: "Archidex",
  social_media: "Social Media",
  website_google: "Website / Google",
  walk_in_showroom: "Walk-in / Showroom",
  referral: "Referral (Customer / Friend)",
  id_architect: "ID / Architect",
  developer_main_contractor: "Developer / Main Contractor",
  tender_portal: "Tender Portal",
  existing_customer: "Existing Customer",
  exhibition_event: "Exhibition / Event",
  cold_call: "Cold Call / Own Prospecting",
};

// A blank select posts "".
const optionalId = z.union([z.literal("").transform(() => null), z.uuid()]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

const amount = z
  .string()
  .trim()
  .transform((text) => (text === "" ? 0 : parseRm(text)))
  .pipe(
    z
      .number("Enter the value as an amount in RM, like 12500.")
      .min(0, "The value can't be negative.")
      .max(999_999_999_999, "That value is too large."),
  );

const quantity = z
  .string()
  .trim()
  .transform((text) => (text === "" ? 0 : Number(text.replace(/,/g, ""))))
  .pipe(
    z
      .number("Enter the quantity as a number.")
      .min(0, "The quantity can't be negative.")
      .max(9_999_999_999, "That quantity is too large."),
  )
  .transform(roundQuantity);

const nextActionDate = z.union([
  z.literal("").transform(() => null),
  z.iso.date("Choose a valid date for the next action."),
]);

export const projectFormSchema = z
  .object({
    contactId: z.uuid({
      error: "Could not find that customer. Reload the page.",
    }),
    name: z
      .string()
      .trim()
      .min(1, "Enter the project name.")
      .max(200, "Keep the project name under 200 characters."),
    leadSource: LeadSource,
    stage: ProjectStage,
    qtySqft: quantity,
    value: amount,
    picId: z.uuid("Choose the person in charge."),
    supportId: optionalId,
    commissionType: AccountType,
    passedBy: optionalId,
    nextAction: optionalText(300),
    nextActionDate,
    notes: optionalText(2000),
  })
  .refine((form) => form.supportId === null || form.supportId !== form.picId, {
    message: "The supporting person must be someone other than the PIC.",
    path: ["supportId"],
  })
  .refine(
    (form) =>
      (form.commissionType === "pass_down") === (form.passedBy !== null),
    { message: "Choose who passed this project down.", path: ["passedBy"] },
  );
export type ProjectForm = z.infer<typeof projectFormSchema>;

export const projectIdSchema = z.uuid({
  error: "Could not find that project. Reload the page.",
});
