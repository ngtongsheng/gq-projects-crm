import { z } from "zod";

export const setPasswordSchema = z
  .object({
    tokenHash: z.string().min(1),
    type: z.enum(["invite", "recovery"]),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords don't match.",
  });
