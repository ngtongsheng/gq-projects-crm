import { HardHat } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { JOB_TYPE_LABEL } from "@/lib/domain/delivery-status";
import {
  inSiteJobFilter,
  jobProgressPercent,
  SITE_JOB_FILTER_LABEL,
  SITE_JOB_FILTERS,
  type SiteJobFilter,
  sortSiteJobs,
} from "@/lib/domain/site-jobs";
import { SITE_ACTIVITY_LABEL } from "@/lib/domain/site-log";
import {
  SITE_STAGE_LABEL,
  SITE_STAGES,
  type SiteStage,
} from "@/lib/domain/site-stage";
import { formatDate } from "@/lib/format/date";
import type { Translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { SegmentLinks } from "./segment-links";
import type { SiteJob } from "./site-jobs-data";

// The demo's stagePill: done is good, delivered or later is warn, the early stages are info.
const stageTone = (stage: SiteStage): StatusTone =>
  stage === "completed"
    ? "good"
    : SITE_STAGES.indexOf(stage) >= SITE_STAGES.indexOf("delivered")
      ? "warn"
      : "info";

function Sub({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("block text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

function Progress({ job, t }: { job: SiteJob; t: Translate }) {
  const percent = jobProgressPercent(job);
  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-9 font-mono text-sm tabular-nums">{percent}%</span>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("Site progress")}
          className="h-2 flex-1 overflow-hidden rounded-full bg-sunk"
        >
          <div
            className={cn(
              "h-full rounded-full",
              percent >= 100 ? "bg-good" : "bg-warn",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {job.installed && (
        <Sub>
          {t("Installed")} {job.installed.pct}% · {formatDate(job.installed.on)}
        </Sub>
      )}
    </div>
  );
}

/** The Jobs tab: where every open job stands on site, least progress first (demo: siteJobs). */
export function JobsTab({
  jobs,
  filter,
  nameOf,
  t,
}: {
  jobs: readonly SiteJob[];
  filter: SiteJobFilter;
  nameOf: (personId: string) => string;
  t: Translate;
}) {
  const shown = sortSiteJobs(
    jobs.filter((job) => inSiteJobFilter(job.siteStage, filter)),
  );
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {SITE_STAGES.map((stage) => (
          <li
            key={stage}
            className="flex min-w-24 flex-col gap-0.5 rounded-xl border bg-card px-4 py-2.5"
          >
            <span className="font-mono text-lg font-semibold tabular-nums">
              {jobs.filter((job) => job.siteStage === stage).length}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(SITE_STAGE_LABEL[stage])}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-heading text-lg font-semibold">{t("Jobs")}</h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {shown.length}
        </span>
        <div className="ml-auto">
          <SegmentLinks
            label={t("Show jobs")}
            active={filter}
            items={SITE_JOB_FILTERS.map((key) => ({
              key,
              label: t(SITE_JOB_FILTER_LABEL[key]),
              href: `/site-work?view=jobs&show=${key}`,
            }))}
          />
        </div>
      </div>
      <DataTable
        rows={shown}
        getRowKey={(job) => job.id}
        empty={<EmptyState icon={HardHat} title={t("No jobs in this view.")} />}
        columns={[
          {
            key: "mof",
            header: t("MOF no."),
            cell: (job) => (
              <Link
                href={`/site-work/${job.id}`}
                className="font-mono font-semibold underline-offset-2 hover:underline"
              >
                {job.mofNo}
              </Link>
            ),
          },
          {
            key: "project",
            header: t("Project"),
            className: "max-w-56 whitespace-normal",
            cell: (job) => (
              <>
                <span className="font-medium">{job.projectName}</span>
                {job.needsFirstVisit && (
                  <>
                    {" "}
                    <StatusBadge tone="bad">{t("New")}</StatusBadge>
                  </>
                )}
                <Sub>
                  {job.companyName}
                  {job.openActions > 0 &&
                    ` · ${job.openActions} ${t(job.openActions === 1 ? "open action" : "open actions")}`}
                </Sub>
              </>
            ),
          },
          {
            key: "salesperson",
            header: t("Salesperson"),
            className: "max-sm:hidden",
            cell: (job) => nameOf(job.salespersonId),
          },
          {
            key: "status",
            header: t("Status"),
            className: "max-w-36 whitespace-normal",
            cell: (job) => (
              <>
                <StatusBadge tone={stageTone(job.siteStage)}>
                  {t(SITE_STAGE_LABEL[job.siteStage])}
                </StatusBadge>
                <Sub>{t(job.delivery.label)}</Sub>
              </>
            ),
          },
          {
            key: "progress",
            header: t("Progress"),
            cell: (job) => <Progress job={job} t={t} />,
          },
          {
            key: "last",
            header: t("Last update"),
            className: "max-w-56 whitespace-normal max-sm:hidden",
            cell: (job) =>
              job.lastVisit ? (
                <>
                  {formatDate(job.lastVisit.visitedOn)}
                  <Sub>
                    {t(SITE_ACTIVITY_LABEL[job.lastVisit.activity])}
                    {job.lastVisit.notes && ` · ${job.lastVisit.notes}`}
                  </Sub>
                </>
              ) : (
                "–"
              ),
          },
          {
            key: "next",
            header: t("Next on site"),
            className: "max-w-48 whitespace-normal max-sm:hidden",
            cell: (job) =>
              job.next ? (
                <>
                  {t(JOB_TYPE_LABEL[job.next.jobType])}{" "}
                  {formatDate(job.next.scheduledOn)}
                  {job.next.endsOn !== job.next.scheduledOn &&
                    ` – ${formatDate(job.next.endsOn)}`}
                  {(job.next.installer || job.next.supervisorId) && (
                    <Sub>
                      {[
                        job.next.installer,
                        job.next.supervisorId && nameOf(job.next.supervisorId),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Sub>
                  )}
                </>
              ) : (
                "–"
              ),
          },
        ]}
      />
    </div>
  );
}
