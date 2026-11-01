import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "staff";

export type Profile = {
  id: string;
  fullName: string | null;
  role: Role;
};

function isRole(value: unknown): value is Role {
  return value === "admin" || value === "staff";
}

/** The signed-in user's profile, or null when signed out. Cached per request. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return null;

  const { data: row, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  if (!isRole(row.role)) throw new Error(`Unknown role: ${String(row.role)}`);

  return { id: row.id, fullName: row.full_name, role: row.role };
});
