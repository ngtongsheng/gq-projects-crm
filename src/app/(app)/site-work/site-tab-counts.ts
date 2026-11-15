import { createClient } from "@/lib/supabase/server";
import type { SiteView } from "./site-view";

/**
 * What waits on three tabs, shown in brackets on the tab. Stock returns has no count: with no
 * status to clear, a number there would never go down.
 */
export async function loadSiteTabCounts(): Promise<
  Partial<Record<SiteView, number>>
> {
  const supabase = await createClient();
  const [measurements, photos, shootings, actions] = await Promise.all([
    supabase
      .from("site_logs")
      .select("id", { count: "exact", head: true })
      .eq("activity", "measurement")
      .eq("measurement_received", false),
    // Shootings and handovers whose photos are not yet saved to Drive.
    supabase
      .from("site_logs")
      .select("id", { count: "exact", head: true })
      .in("activity", ["shooting", "handover"])
      .is("photos_saved_at", null),
    supabase
      .from("shoot_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "requested"),
    // Marketing cannot read follow-ups, so for them this counts nothing.
    supabase
      .from("site_follow_ups")
      .select("id", { count: "exact", head: true })
      .is("done_at", null),
  ]);
  const failed =
    measurements.error ?? photos.error ?? shootings.error ?? actions.error;
  if (failed) throw new Error(`Could not count site work: ${failed.message}`);
  return {
    meas: measurements.count ?? 0,
    shots: (photos.count ?? 0) + (shootings.count ?? 0),
    actions: actions.count ?? 0,
  };
}
