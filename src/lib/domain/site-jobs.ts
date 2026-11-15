import type { JobStatus, JobType } from "@/lib/domain/delivery-status";
import type { SiteActivity } from "@/lib/domain/site-log";
import { type SiteStage, siteJobPercent } from "@/lib/domain/site-stage";
import type { CalendarDate } from "@/lib/format/date";

/** The Jobs tab's filter (demo: sFilter). */
export const SITE_JOB_FILTERS = ["ongoing", "done", "all"] as const;
export type SiteJobFilter = (typeof SITE_JOB_FILTERS)[number];

export const SITE_JOB_FILTER_LABEL: Record<SiteJobFilter, string> = {
  ongoing: "On-going",
  done: "Completed",
  all: "All",
};

export function parseSiteJobFilter(
  value: string | string[] | undefined,
): SiteJobFilter {
  return SITE_JOB_FILTERS.find((filter) => filter === value) ?? "ongoing";
}

export const inSiteJobFilter = (
  stage: SiteStage,
  filter: SiteJobFilter,
): boolean =>
  filter === "all" || (filter === "done") === (stage === "completed");

/** A visit that recorded how much was installed. */
export type InstalledLog = {
  activity: SiteActivity;
  instPct: number | null;
  visitedOn: CalendarDate;
  createdAt: string;
};

/** The latest installed % logged for a job, or null before any was. */
export function latestInstalled(
  logs: readonly InstalledLog[],
): { pct: number; on: CalendarDate } | null {
  let latest: { pct: number; on: CalendarDate; createdAt: string } | null =
    null;
  for (const log of logs) {
    if (log.activity !== "installation" || log.instPct === null) continue;
    if (
      !latest ||
      log.visitedOn > latest.on ||
      (log.visitedOn === latest.on && log.createdAt > latest.createdAt)
    ) {
      latest = {
        pct: log.instPct,
        on: log.visitedOn,
        createdAt: log.createdAt,
      };
    }
  }
  return latest && { pct: latest.pct, on: latest.on };
}

type Progress = {
  siteStage: SiteStage;
  installed: { pct: number } | null;
};

/** The job's progress, as the Jobs tab's Progress column shows it. */
export const jobProgressPercent = (job: Progress): number =>
  siteJobPercent(job.siteStage, job.installed?.pct ?? null);

/** Least progress first, so the jobs needing attention lead; then by MOF number. */
export function sortSiteJobs<Job extends Progress & { mofNo: string }>(
  jobs: readonly Job[],
): Job[] {
  return [...jobs].sort(
    (a, b) =>
      jobProgressPercent(a) - jobProgressPercent(b) ||
      a.mofNo.localeCompare(b.mofNo),
  );
}

/**
 * A registered MOF with no visit since it was registered: it needs its first site visit. A
 * visit to the same project logged before the MOF existed counts (visit days include those).
 */
export const needsFirstVisit = (
  job: { siteStage: SiteStage; registeredOn: CalendarDate },
  visitDays: readonly CalendarDate[],
): boolean =>
  job.siteStage !== "completed" &&
  !visitDays.some((day) => day >= job.registeredOn);

/** A scheduled job as the Jobs tab's "Next on site" column lists it. */
export type ScheduledSiteJob = {
  jobType: JobType;
  status: JobStatus;
  scheduledOn: CalendarDate;
  endsOn: CalendarDate;
};

/** The earliest job not yet done or postponed that has not ended. */
export function nextOnSite<Job extends ScheduledSiteJob>(
  jobs: readonly Job[],
  today: CalendarDate,
): Job | null {
  const upcoming = jobs
    .filter(
      (job) =>
        job.endsOn >= today &&
        job.status !== "done" &&
        job.status !== "postponed",
    )
    .sort((a, b) => a.scheduledOn.localeCompare(b.scheduledOn));
  return upcoming[0] ?? null;
}
