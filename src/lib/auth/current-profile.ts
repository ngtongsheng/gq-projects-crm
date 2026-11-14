import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CommissionMode, JobRole } from "./job-role";

export type Role = "admin" | "staff";

/** Signs out someone who has left; see the route there. */
export const LEFT_PATH = "/left";

const profileRow = z
  .object({
    id: z.string(),
    full_name: z.string().nullable(),
    role: z.enum(["admin", "staff"]),
    job_role: JobRole,
    arranges_stock: z.boolean(),
    commission_mode: CommissionMode,
    yearly_target: z.coerce.number().nullable(),
    active: z.boolean(),
  })
  .transform((row) => ({
    active: row.active,
    profile: {
      id: row.id,
      fullName: row.full_name,
      role: row.role,
      jobRole: row.job_role,
      arrangesStock: row.arranges_stock,
      commissionMode: row.commission_mode,
      yearlyTarget: row.yearly_target,
    },
  }));

export type Profile = z.infer<typeof profileRow>["profile"];

/**
 * The signed-in user's profile, or null when signed out. Cached per request. Someone who has
 * left is sent to be signed out; the database already refuses them everything else.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, job_role, arranges_stock, commission_mode, yearly_target, active",
    )
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load profile: ${error.message}`);

  const parsed = profileRow.safeParse(row);
  if (!parsed.success) {
    throw new Error(`Unexpected profile: ${parsed.error.message}`);
  }
  if (!parsed.data.active) redirect(LEFT_PATH);
  return parsed.data.profile;
});
