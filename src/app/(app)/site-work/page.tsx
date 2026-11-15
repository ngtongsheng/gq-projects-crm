import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { canEditSite } from "@/lib/auth/job-role";
import { canOpen } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { jobProgressPercent, parseSiteJobFilter } from "@/lib/domain/site-jobs";
import { SITE_STAGE_LABEL } from "@/lib/domain/site-stage";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { recordHref } from "../today/record-link";
import { ActionsTab } from "./actions-tab";
import { DailyLogTab } from "./daily-log-tab";
import { JobsTab } from "./jobs-tab";
import { MeasurementsTab } from "./measurements-tab";
import { MofFinder } from "./mof-finder";
import { NewMofBanner } from "./new-mof-banner";
import { PendingClaims } from "./pending-claims";
import { PhotosTab } from "./photos-tab";
import { loadSiteJobs } from "./site-jobs-data";
import { SiteLogTab } from "./site-log-tab";
import { loadSiteTabCounts } from "./site-tab-counts";
import { SiteTabs } from "./site-tabs";

import { parseSiteView, siteViewsFor } from "./site-view";
import { loadPendingClaims } from "./site-work-data";
import { StockReturnsTab } from "./stock-returns-tab";

export const metadata: Metadata = { title: "Site Work" };

export default async function SiteWorkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("site");
  const t = await getT(me.language);
  const params = await searchParams;
  const views = siteViewsFor(me);
  const view = parseSiteView(params.view, views);
  const today = todayMyt();

  const [jobs, counts, team, claims, canRecord] = await Promise.all([
    loadSiteJobs(),
    loadSiteTabCounts(),
    getTeamDirectory(),
    view === "jobs" && canEditSite(me.jobRole)
      ? loadPendingClaims(me)
      : Promise.resolve([]),
    // The Log work wizard is the Site Supervisor's own page.
    canEditSite(me.jobRole) ? canOpen(me, "today") : false,
  ]);
  const names = new Map(team.map((member) => [member.id, member.name]));
  const nameOf = (personId: string) => names.get(personId) ?? t("Unnamed");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Site Work"
        description={t(
          me.jobRole === "site"
            ? "Log every site visit here. It fills your monthly report automatically."
            : "Job status by MOF, the site supervisors' log, follow-up actions and balance stock.",
        )}
        actions={
          <>
            <MofFinder
              rows={jobs.map((job) => ({
                id: job.id,
                mofNo: job.mofNo,
                projectName: job.projectName,
                companyName: job.companyName,
                salesperson: nameOf(job.salespersonId),
                progress: `${t(SITE_STAGE_LABEL[job.siteStage])} ${jobProgressPercent(job)}%`,
              }))}
            />
            {canRecord && (
              <Button asChild>
                <Link href={recordHref(today)}>
                  <Plus data-icon="inline-start" />
                  {t("Log site visit")}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <NewMofBanner
        jobs={jobs.filter((job) => job.needsFirstVisit)}
        today={today}
        nameOf={nameOf}
        canLog={canRecord}
        t={t}
      />
      <SiteTabs views={views} active={view} counts={counts} t={t} />
      {view === "jobs" ? (
        <div className="flex flex-col gap-4">
          <PendingClaims claims={claims} />
          <JobsTab
            jobs={jobs}
            filter={parseSiteJobFilter(params.show)}
            nameOf={nameOf}
            t={t}
          />
        </div>
      ) : view === "log" ? (
        <SiteLogTab me={me} params={params} nameOf={nameOf} t={t} />
      ) : view === "meas" ? (
        <MeasurementsTab me={me} nameOf={nameOf} t={t} />
      ) : view === "shots" ? (
        <PhotosTab me={me} jobs={jobs} nameOf={nameOf} t={t} />
      ) : view === "actions" ? (
        <ActionsTab me={me} params={params} nameOf={nameOf} t={t} />
      ) : view === "returns" ? (
        <StockReturnsTab me={me} nameOf={nameOf} t={t} />
      ) : (
        <DailyLogTab me={me} nameOf={nameOf} t={t} />
      )}
    </div>
  );
}
