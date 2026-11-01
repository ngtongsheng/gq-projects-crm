import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { supabaseEnv } from "./env";

export const SIGN_IN_PATH = "/sign-in";

/**
 * Refreshes the auth session cookies on every request and redirects:
 * signed out → /sign-in, signed in on /sign-in → /.
 * This is an optimistic check; pages still enforce access with requireRole.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Nothing may run between client creation and this call, or sessions can drop.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const onSignIn = request.nextUrl.pathname === SIGN_IN_PATH;

  if (signedIn === onSignIn) {
    return redirectKeepingCookies(
      request,
      response,
      signedIn ? "/" : SIGN_IN_PATH,
    );
  }
  return response;
}

function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
