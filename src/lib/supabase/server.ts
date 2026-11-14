import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isViewingAs } from "@/lib/auth/impersonation";
import { supabaseEnv } from "./env";
import { viewOnlyFetch } from "./view-only-fetch";

/** Per-request client for Server Components, Server Actions and Route Handlers. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient(url, publishableKey, {
    global: { fetch: viewOnlyFetch(isViewingAs) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
