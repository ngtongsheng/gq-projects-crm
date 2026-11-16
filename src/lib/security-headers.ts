type Header = { key: string; value: string };

type SecurityHeaderOptions = {
  supabaseUrl: string | undefined;
  development: boolean;
};

const TWO_YEARS_SECONDS = 63072000;

/** The origin of an API URL, plus its wss twin for realtime; empty when the URL is missing or not valid. */
function supabaseOrigins(supabaseUrl: string | undefined): {
  http: string[];
  socket: string[];
} {
  if (!supabaseUrl) return { http: [], socket: [] };
  try {
    const { origin, host } = new URL(supabaseUrl);
    return { http: [origin], socket: [`wss://${host}`] };
  } catch {
    return { http: [], socket: [] };
  }
}

/**
 * Inline scripts and styles stay allowed because Next.js emits inline bootstrap scripts and this
 * app does not use per-request nonces (decision D3 in loop 24).
 * form-action lists the sign-in redirect chain: Chrome checks it again on a form's redirect.
 */
export function contentSecurityPolicy({
  supabaseUrl,
  development,
}: SecurityHeaderOptions): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      ["'self'", "'unsafe-inline'", ...(development ? ["'unsafe-eval'"] : [])],
    ],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...supabase.http]],
    ["connect-src", ["'self'", ...supabase.http, ...supabase.socket]],
    ["font-src", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["base-uri", ["'self'"]],
    [
      "form-action",
      ["'self'", "https://accounts.google.com", ...supabase.http],
    ],
    ["object-src", ["'none'"]],
  ];
  return directives
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): Header[] {
  return [
    {
      key: "Content-Security-Policy",
      value: contentSecurityPolicy(options),
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    {
      key: "Strict-Transport-Security",
      value: `max-age=${TWO_YEARS_SECONDS}; includeSubDomains`,
    },
    // No screen opens the camera itself: photos come through file pickers.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
}
