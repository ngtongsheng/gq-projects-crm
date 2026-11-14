// Sets one Supabase project's sign-in settings through the Management API: Google sign-in on,
// sign-ups off, site URL and redirect allow-list. Only these fields are sent, so every other auth
// setting stays as it is. Values come from env so the same script serves the test copy, the live
// app and a later move to new accounts (docs/handover-migration.md).
//
// Usage (CI: .github/workflows/auth-config.yml):
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... GOOGLE_OAUTH_CLIENT_ID=... \
//   GOOGLE_OAUTH_CLIENT_SECRET=... AUTH_SITE_URL=https://app.example.com \
//   AUTH_REDIRECT_URLS="https://app.example.com/**,http://localhost:3000/**" node scripts/push-auth-config.ts

const REQUIRED = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "AUTH_SITE_URL",
  "AUTH_REDIRECT_URLS",
] as const;

type AuthConfigEnv = Record<(typeof REQUIRED)[number], string>;

export function readAuthConfigEnv(
  env: Record<string, string | undefined>,
): AuthConfigEnv {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
  return Object.fromEntries(
    REQUIRED.map((name) => [name, env[name]?.trim() ?? ""]),
  ) as AuthConfigEnv;
}

/** The PATCH body for /v1/projects/{ref}/config/auth. */
export function authConfigBody(env: AuthConfigEnv) {
  const redirectUrls = env.AUTH_REDIRECT_URLS.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return {
    site_url: env.AUTH_SITE_URL,
    uri_allow_list: redirectUrls.join(","),
    disable_signup: true,
    external_google_enabled: true,
    external_google_client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    external_google_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  };
}

async function pushAuthConfig() {
  const env = readAuthConfigEnv(process.env);
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(authConfigBody(env)),
    },
  );
  // The response echoes the whole auth config, secrets included, so only the status is printed.
  if (!response.ok) {
    throw new Error(
      `Supabase refused the auth config: HTTP ${response.status}`,
    );
  }
  console.log("Auth config pushed: Google sign-in on, sign-ups off.");
}

if (import.meta.main) {
  await pushAuthConfig();
}
