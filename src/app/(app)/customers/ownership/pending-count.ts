import { createClient } from "@/lib/supabase/server";

/** Requests waiting for the MD or Sales Director, for the sidebar badge. */
export async function countPendingOwnershipRequests(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ownership_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) {
    console.error("Could not count ownership requests", error);
    return 0;
  }
  return count ?? 0;
}
