import { createClient } from "@supabase/supabase-js";
import { isViewingAs } from "@/lib/auth/impersonation";
import { viewOnlyFetch } from "./view-only-fetch";

export const ADMIN_UNAVAILABLE_MESSAGE =
  "Adding people works on the preview link or the live site.";

/**
 * Server-only client with the service-role key. Returns null when the key is
 * not set (it lives only on Vercel, never on a laptop), so callers can show a
 * plain message instead of crashing. Never import this from client code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: viewOnlyFetch(isViewingAs) },
  });
}
