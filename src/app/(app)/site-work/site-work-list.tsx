"use client";

import { HardHat, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Input } from "@/components/ui/input";
import { searchSites, splitToday } from "@/lib/domain/site-search";
import { siteStagePercent } from "@/lib/domain/site-stage";
import { SiteLogDialog } from "./site-log-dialog";
import type { SiteSummary } from "./site-work-data";

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
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <Link
        href={`/site-work/${site.id}`}
        className="flex min-w-0 flex-1 items-baseline justify-between gap-3 hover:opacity-80"
      >
        <span className="min-w-0 truncate">
          <span className="font-mono text-sm text-muted-foreground">
            {site.mofNo}
          </span>
          {" - "}
          <span className="font-heading font-semibold">{site.projectName}</span>
        </span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {siteStagePercent(site.siteStage)}%
        </span>
      </Link>
      {canLog && (
        <SiteLogDialog
          mofId={site.id}
          today={today}
          projectName={`${site.mofNo} · ${site.projectName}`}
          compact
        />
      )}
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
                : "Orders appear here until they are completed, closed or cancelled."
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
