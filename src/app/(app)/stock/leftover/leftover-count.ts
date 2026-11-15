import { createClient } from "@/lib/supabase/server";

/** Leftover items kept at Best Link for resale, for the Stock segment label. */
export async function countLeftoverAtBestLink(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("leftovers")
    .select("id", { count: "exact", head: true })
    .eq("status", "at_best_link");
  if (error)
    throw new Error(`Could not count leftover stock: ${error.message}`);
  return count ?? 0;
}
