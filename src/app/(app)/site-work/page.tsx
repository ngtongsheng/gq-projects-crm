import { HardHat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { canEditSite } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { MOF_STAGE_LABEL, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import { SITE_ACTIVITY_LABEL } from "@/lib/domain/site-log";
import { formatDate, todayMyt } from "@/lib/format/date";
import { PendingClaims } from "./pending-claims";
import {
  loadActiveSites,
  loadPendingClaims,
  type SiteSummary,
} from "./site-work-data";
import { StageProgress } from "./stage-progress";

export const metadata: Metadata = { title: "Site Work" };

function SiteCard({ site }: { site: SiteSummary }) {
  return (
    <Link
      href={`/site-work/${site.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-sunk"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="font-heading font-semibold">{site.projectName}</span>
          <span className="text-sm text-muted-foreground">
            <span className="font-mono">{site.mofNo}</span> · {site.companyName}
          </span>
        </div>
        <StatusBadge tone={MOF_STAGE_TONE[site.mofStage]}>
          {MOF_STAGE_LABEL[site.mofStage]}
        </StatusBadge>
      </div>
      <StageProgress stage={site.siteStage} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {site.lastVisit
            ? `Last visit: ${SITE_ACTIVITY_LABEL[site.lastVisit.activity]}, ${formatDate(site.lastVisit.visitedOn)}`
            : "No visits logged yet"}
        </span>
        {site.openFollowUps > 0 && (
          <span className={site.overdueFollowUps > 0 ? "text-bad" : undefined}>
            {site.openFollowUps} open follow-up
            {site.openFollowUps === 1 ? "" : "s"}
            {site.overdueFollowUps > 0 && `, ${site.overdueFollowUps} overdue`}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function SiteWorkPage() {
  const me = await requireSection("siteWork");
  const [sites, claims] = await Promise.all([
    loadActiveSites(todayMyt()),
    canEditSite(me.jobRole) ? loadPendingClaims(me) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Site Work"
        description="Open orders with how far the site has got. Open one to log a visit."
      />
      <PendingClaims claims={claims} />
      {sites.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={HardHat}
            title="No open sites"
            description="Orders appear here until they are closed or cancelled."
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}
    </div>
  );
}
