// The scripts import this too (people.ts), so imports are relative with extensions.
import { DEV_PROJECT_REF, projectRefFromUrl } from "../supabase/test-copy.ts";
import type { JobRole } from "./job-role.ts";

/** One test sign-in per job role on the test copy. .invalid never resolves, so no real mail. */
export const TEST_SIGN_IN_EMAILS: Record<JobRole, string> = {
  md: "test-md@example.invalid",
  director: "test-director@example.invalid",
  bd: "test-bd@example.invalid",
  sales: "test-sales@example.invalid",
  accounts: "test-accounts@example.invalid",
  site: "test-site@example.invalid",
  support: "test-support@example.invalid",
};

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
