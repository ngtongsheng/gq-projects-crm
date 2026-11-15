import type { createClient } from "@/lib/supabase/server";

/**
 * Logging a shooting at a MOF answers every open request for it (demo: the Shooting save).
 * The visit is already saved, so a failure here is logged and the requests stay open to be
 * cancelled by hand.
 */
export async function markShootRequestsDone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mofId: string,
): Promise<void> {
  const { error } = await supabase
    .from("shoot_requests")
    .update({ status: "done" })
    .eq("mof_id", mofId)
    .eq("status", "requested");
  if (error) console.error("Could not mark the shooting requests done", error);
}
