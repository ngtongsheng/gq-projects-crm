import { z } from "zod";
import { CommissionMode, JobRole } from "@/lib/auth/job-role";
import { normaliseMobile } from "@/lib/domain/mobile";
import { optionalId, optionalText } from "@/lib/form/form-fields";

export const roleSchema = z.enum(["admin", "staff"]);

/** The language the app speaks to this person in. */
export const Language = z.enum(["en", "bm", "zh"]);
export type Language = z.infer<typeof Language>;

export const LanguageLabel: Record<Language, string> = {
  en: "English",
  bm: "Bahasa Melayu",
  zh: "中文",
};

// Blank is no number; saved as digits with the country code, like the contacts' mobiles.
const whatsappSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const mobile = normaliseMobile(value);
    if (!mobile) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a full Malaysian mobile number, like 012-345 6789.",
      });
      return z.NEVER;
    }
    return mobile;
  });

const optionalDate = (message: string) =>
  z
    .union([z.literal(""), z.iso.date(message)])
    .transform((value) => (value === "" ? null : value));

// A checked checkbox posts "on"; an unchecked one posts nothing.
const checkbox = z
  .literal("on")
  .nullable()
  .transform((value) => value === "on");

const personFields = {
  title: optionalText(120),
  joinedOn: optionalDate("Choose the date they joined."),
  reportsTo: optionalId("Choose who they report to."),
  language: Language,
};

export const addPersonSchema = z.object({
  fullName: z.string().trim().min(1, "Enter their name.").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  role: roleSchema,
  // The database default for a new person.
  jobRole: JobRole.default("sales"),
  // Also opens WhatsApp with the invite ready.
  mobile: whatsappSchema,
  ...personFields,
});

export const newLinkSchema = z.object({ userId: z.uuid() });

export const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
});

// Typed in RM; commas are allowed so "250,000" works. Blank means no target.
const yearlyTargetSchema = z
  .string()
  .trim()
  .transform((value) => value.replaceAll(",", ""))
  .pipe(
    z
      .string()
      .regex(
        /^(\d{1,12}(\.\d{1,2})?)?$/,
        "Enter the yearly target in RM, like 250000 or 250000.50.",
      ),
  )
  .transform((value) => (value === "" ? null : Number(value)));

export const personSettingsSchema = z
  .object({
    userId: z.uuid(),
    jobRole: JobRole,
    arrangesStock: checkbox,
    sells: checkbox,
    seesMargin: checkbox,
    commissionMode: CommissionMode,
    yearlyTarget: yearlyTargetSchema,
    whatsapp: whatsappSchema,
    ...personFields,
    hasLeft: checkbox,
    leftOn: optionalDate("Choose the date they left."),
    leftReason: optionalText(500),
  })
  .refine((person) => !person.hasLeft || person.leftOn !== null, {
    path: ["leftOn"],
    message: "Enter the date they left.",
  })
  // Someone still here has no leaving date or reason.
  .transform(({ hasLeft, leftOn, leftReason, ...person }) => ({
    ...person,
    active: !hasLeft,
    leftOn: hasLeft ? leftOn : null,
    leftReason: hasLeft ? leftReason : null,
  }));
