// The scripts import this too (people.ts), so imports are relative with extensions.
import { DEV_PROJECT_REF, projectRefFromUrl } from "../supabase/test-copy.ts";

/** Test people sign in with an address on this domain. .invalid never resolves, so no real mail. */
export const TEST_EMAIL_DOMAIN = "example.invalid";

export function testSignInEmail(personKey: string): string {
  return `test-${personKey}@${TEST_EMAIL_DOMAIN}`;
}

export function isTestSignInEmail(email: string | undefined): boolean {
  return !!email?.endsWith(`@${TEST_EMAIL_DOMAIN}`);
}

/**
 * One-click sign-in works only under `pnpm dev` against the test copy. Vercel previews run with
 * NODE_ENV=production, and the live app has its own project, so both are refused.
 */
export function isDevSignInAllowed(env: {
  nodeEnv: string | undefined;
  supabaseUrl: string | undefined;
}): boolean {
  if (env.nodeEnv !== "development" || !env.supabaseUrl) return false;
  return projectRefFromUrl(env.supabaseUrl) === DEV_PROJECT_REF;
}
