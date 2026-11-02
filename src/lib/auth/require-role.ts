import { redirect } from "next/navigation";
import { getCurrentProfile, type Profile, type Role } from "./current-profile";

/**
 * Server-side gate for pages and actions. Returns the profile when the
 * signed-in user has `role` (admins also pass "staff"); otherwise redirects:
 * signed out → /sign-in, wrong role → /.
 */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  if (role === "admin" && profile.role !== "admin") redirect("/");
  return profile;
}
