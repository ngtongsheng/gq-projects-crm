"use client";

import { HardHat, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Input } from "@/components/ui/input";
import { MOF_STAGE_LABEL, MOF_STAGE_TONE } from "@/lib/domain/mof-stages";
import { SITE_ACTIVITY_LABEL } from "@/lib/domain/site-log";
import { searchSites, splitToday } from "@/lib/domain/site-search";
import { formatDate } from "@/lib/format/date";
import { SiteLogDialog } from "./site-log-dialog";
import type { SiteSummary } from "./site-work-data";
import { StageProgress } from "./stage-progress";

function SiteCard({
  site,
  today,
  canLog,
}: {
  site: SiteSummary;
  today: string;
  canLog: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <Link
        href={`/site-work/${site.id}`}
        className="flex flex-col gap-3 hover:opacity-80"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-heading font-semibold">
              {site.projectName}
            </span>
            <span className="text-sm text-muted-foreground">
              <span className="font-mono">{site.mofNo}</span> ·{" "}
              {site.companyName}
            </span>
          </div>
          <StatusBadge tone={MOF_STAGE_TONE[site.mofStage]}>
            {MOF_STAGE_LABEL[site.mofStage]}
          </StatusBadge>
        </div>
        <StageProgress stage={site.siteStage} />
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {site.lastVisit
              ? `Last visit: ${SITE_ACTIVITY_LABEL[site.lastVisit.activity]}, ${formatDate(site.lastVisit.visitedOn)}`
              : "No visits logged yet"}
          </span>
          {site.openFollowUps > 0 && (
            <span
              className={site.overdueFollowUps > 0 ? "text-bad" : undefined}
            >
              {site.openFollowUps} open follow-up
              {site.openFollowUps === 1 ? "" : "s"}
              {site.overdueFollowUps > 0 &&
                `, ${site.overdueFollowUps} overdue`}
            </span>
          )}
        </div>
        {canLog && (
          <SiteLogDialog
            mofId={site.id}
            today={today}
            projectName={`${site.mofNo} · ${site.projectName}`}
            compact
          />
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  sites,
  today,
  canLog,
}: {
  title?: string;
  sites: SiteSummary[];
  today: string;
  canLog: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && <h2 className="font-heading text-lg font-semibold">{title}</h2>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} today={today} canLog={canLog} />
        ))}
      </div>
    </section>
  );
}

/**
 * The open projects with a way to find one and log a visit on the spot. The ones the person has a
 * job on today come first.
 */
export function SiteWorkList({
  sites,
  todayIds,
  canLog,
  today,
}: {
  sites: SiteSummary[];
  /** Projects the person has a job on today. */
  todayIds: string[];
  canLog: boolean;
  today: string;
}) {
  const [query, setQuery] = useState("");
  const found = searchSites(sites, query);
  const { today: working, others } = splitToday(found, new Set(todayIds));

  return (
    <div className="flex flex-col gap-6">
      <div className="relative max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Find a project"
          placeholder="Find by MOF no., project, company or site"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-9"
        />
      </div>
      {found.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={HardHat}
            title={query ? "No project matches" : "No open sites"}
            description={
              query
                ? "Try a different word, or clear the box."
                : "Orders appear here until they are closed or cancelled."
            }
          />
        </div>
      ) : (
        <>
          {working.length > 0 && (
            <Group
              title="Today"
              sites={working}
              today={today}
              canLog={canLog}
            />
          )}
          {others.length > 0 && (
            <Group
              title={working.length > 0 ? "All open sites" : undefined}
              sites={others}
              today={today}
              canLog={canLog}
            />
          )}
        </>
      )}
    </div>
  );
}
