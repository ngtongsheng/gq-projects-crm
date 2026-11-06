import { z } from "zod";
import { CommissionMode, JobRole } from "@/lib/auth/job-role";
import { normaliseMobile } from "@/lib/domain/mobile";

export const roleSchema = z.enum(["admin", "staff"]);

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
  // Optional, used only to open WhatsApp with the message ready; never saved.
  mobile: z
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
    }),
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

export const personSettingsSchema = z.object({
  userId: z.uuid(),
  jobRole: JobRole,
  // A checked checkbox posts "on"; an unchecked one posts nothing.
  arrangesStock: z
    .literal("on")
    .nullable()
    .transform((value) => value === "on"),
  commissionMode: CommissionMode,
  yearlyTarget: yearlyTargetSchema,
});
