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
