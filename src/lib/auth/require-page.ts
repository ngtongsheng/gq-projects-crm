import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, type Profile } from "./current-profile";
import { canOpen } from "./page-access";
import { isBuilt, type PageKey } from "./pages";

/**
 * Server-side gate for a page's routes and actions. Returns the profile when the person may
 * open any of `keys`; otherwise signed out → /sign-in, a page not built yet → 404, a hidden
 * page → /not-allowed. People stays on requireRole("admin").
 */
export async function requirePage(
  ...keys: [PageKey, ...PageKey[]]
): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/sign-in");
  if (!keys.some(isBuilt)) notFound();
  for (const key of keys) {
    if (await canOpen(profile, key)) return profile;
  }
  redirect("/not-allowed");
}
