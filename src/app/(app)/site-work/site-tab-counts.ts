import { createClient } from "@/lib/supabase/server";
import type { SiteView } from "./site-view";

/**
 * What waits on two tabs, shown in brackets on the tab. The photos and stock-return tabs
 * add their own counts when they are built.
 */
export async function loadSiteTabCounts(): Promise<
  Partial<Record<SiteView, number>>
> {
  const supabase = await createClient();
  const [measurements, actions] = await Promise.all([
    supabase
      .from("site_logs")
      .select("id", { count: "exact", head: true })
      .eq("activity", "measurement")
      .eq("measurement_received", false),
    supabase
      .from("site_follow_ups")
      .select("id", { count: "exact", head: true })
      .is("done_at", null),
  ]);
  const failed = measurements.error ?? actions.error;
  if (failed) throw new Error(`Could not count site work: ${failed.message}`);
  return { meas: measurements.count ?? 0, actions: actions.count ?? 0 };
}
