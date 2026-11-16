import { logServerError } from "@/lib/log-server-error";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Impersonation } from "./impersonation";

/**
 * Stamps ended_at on the impersonation_log row of a view that is over. The admin client refuses
 * writes while the impersonation cookie is present (view-only-fetch.ts), so callers delete the
 * cookie first. A failure is logged, never thrown: the person must still leave or switch back.
 */
export async function closeImpersonationLog(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  impersonation: Impersonation,
): Promise<void> {
  const { error } = await admin
    .from("impersonation_log")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", impersonation.logId);
  if (error) {
    logServerError("Could not close the view as record", error, {
      profileId: impersonation.adminId,
      recordId: impersonation.logId,
    });
  }
}
