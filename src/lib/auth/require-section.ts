import { redirect } from "next/navigation";
import { getCurrentProfile, type Profile } from "./current-profile";
import { canOpenSection, type SectionKey } from "./nav-sections";

/**
 * Server-side gate for a section's pages. Returns the profile when the
 * person's job role may open `key`; otherwise redirects: signed out → /sign-in,
 * hidden section → /not-allowed. People stays on requireRole("admin").
 */
export async function requireSection(key: SectionKey): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  if (!canOpenSection(profile.jobRole, key)) redirect("/not-allowed");
  return profile;
}
