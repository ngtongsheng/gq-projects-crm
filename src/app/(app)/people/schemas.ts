import { z } from "zod";

export const roleSchema = z.enum(["admin", "staff"]);

export const addPersonSchema = z.object({
  fullName: z.string().trim().min(1, "Enter their name.").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  role: roleSchema,
});

export const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
});
