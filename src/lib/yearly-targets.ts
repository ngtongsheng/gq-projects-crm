import { createClient } from "@/lib/supabase/server";
import { VIEW_ONLY_CODE } from "@/lib/supabase/view-only-fetch";

/**
 * Brings profiles.yearly_target up to date for the current year. The database keeps it in step
 * on every change, but nothing fires on 1 January, so the readers call this first. A failure
 * leaves the last saved numbers, which beats a broken page.
 */
export async function refreshYearlyTargets(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_yearly_targets");
  // View as refuses anything that could save; the numbers get refreshed on the next normal visit.
  if (error && error.code !== VIEW_ONLY_CODE) {
    console.error("Could not refresh the yearly targets", error);
  }
}

/** The person's yearly target for this year, refreshed first. */
export async function loadOwnYearlyTarget(
  profileId: string,
): Promise<number | null> {
  await refreshYearlyTargets();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("yearly_target")
    .eq("id", profileId)
    .single();
  if (error)
    throw new Error(`Could not load the yearly target: ${error.message}`);
  return data.yearly_target === null ? null : Number(data.yearly_target);
}
