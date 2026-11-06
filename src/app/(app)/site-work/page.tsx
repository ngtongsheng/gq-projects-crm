import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { canEditSite } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { todayMyt } from "@/lib/format/date";
import { PendingClaims } from "./pending-claims";
import {
  loadActiveSites,
  loadPendingClaims,
  loadTodaysSiteIds,
} from "./site-work-data";
import { SiteWorkList } from "./site-work-list";

export const metadata: Metadata = { title: "Site Work" };

export default async function SiteWorkPage() {
  const me = await requireSection("siteWork");
  const today = todayMyt();
  const canLog = canEditSite(me.jobRole);
  const [sites, claims, todayIds] = await Promise.all([
    loadActiveSites(today),
    canLog ? loadPendingClaims(me) : Promise.resolve([]),
    // Only a Site Supervisor has jobs of their own to put first.
    me.jobRole === "site"
      ? loadTodaysSiteIds(me.id, today)
      : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Site Work"
        description={
          canLog
            ? "Open orders with how far the site has got. Find the project, then press Log visit."
            : "Open orders with how far the site has got. Open one to see its visits."
        }
      />
      <PendingClaims claims={claims} />
      <SiteWorkList
        sites={sites}
        todayIds={todayIds}
        canLog={canLog}
        today={today}
      />
    </div>
  );
}
