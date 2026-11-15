// Values mirror the site_stage check constraint in the site_work migration.
export const SITE_STAGES = [
  "start",
  "ongoing",
  "shipment",
  "delivered",
  "installation",
  "completed",
] as const;
export type SiteStage = (typeof SITE_STAGES)[number];

export const SITE_STAGE_LABEL: Record<SiteStage, string> = {
  start: "Start",
  ongoing: "On-going",
  shipment: "Shipment",
  delivered: "Delivered",
  installation: "Installation in progress",
  completed: "Completed",
};

const SITE_STAGE_PERCENT: Record<SiteStage, number> = {
  start: 10,
  ongoing: 25,
  shipment: 45,
  delivered: 60,
  installation: 80,
  completed: 100,
};

export const siteStagePercent = (stage: SiteStage): number =>
  SITE_STAGE_PERCENT[stage];

/**
 * The job's progress while installation is in progress, from how much is laid (loop 17 D6):
 * 60% at delivery plus 35% of the installed share, capped at 95% until handover.
 */
export const installationJobPercent = (installedPct: number): number =>
  Math.min(95, 60 + Math.round(installedPct * 0.35));

/** The job's progress: the latest installed % while installing, otherwise the stage's. */
export const siteJobPercent = (
  stage: SiteStage,
  latestInstalledPct: number | null,
): number =>
  stage === "installation" && latestInstalledPct !== null
    ? installationJobPercent(latestInstalledPct)
    : siteStagePercent(stage);

/** What a saved visit did that moves the site along (loop 17 D6). */
export type VisitProgress = {
  installation: boolean;
  handoverSigned: boolean;
  delivery: boolean;
};

/**
 * The stage after a visit: a signed handover completes the job, installation puts it in
 * progress, a delivery marks it delivered. Never moves backwards, so a stage someone set by
 * hand further along is kept.
 */
export function stageAfterVisit(
  current: SiteStage,
  visit: VisitProgress,
): SiteStage {
  const reached: SiteStage | null = visit.handoverSigned
    ? "completed"
    : visit.installation
      ? "installation"
      : visit.delivery
        ? "delivered"
        : null;
  if (!reached) return current;
  return SITE_STAGES.indexOf(reached) > SITE_STAGES.indexOf(current)
    ? reached
    : current;
}
