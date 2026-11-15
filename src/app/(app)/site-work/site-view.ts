import { isManager, type JobRole } from "@/lib/auth/job-role";

/** The seven tabs of Site Work; each is its own address (`?view=`) so it survives a reload. */
export const SITE_VIEWS = [
  "jobs",
  "log",
  "meas",
  "shots",
  "actions",
  "returns",
  "remind",
] as const;
export type SiteView = (typeof SITE_VIEWS)[number];

export const SITE_VIEW_LABEL: Record<SiteView, string> = {
  jobs: "Jobs",
  log: "Site log",
  meas: "Measurements",
  shots: "Photos & videos",
  actions: "Actions needed",
  returns: "Stock returns",
  remind: "Daily log & reminders",
};

type Viewer = { jobRole: JobRole; arrangesStock: boolean };

/**
 * The tabs a person sees (demo: vSite). Marketing sees only photos and the log; the daily
 * reminders are for managers and the support team.
 */
export function siteViewsFor(viewer: Viewer): readonly SiteView[] {
  if (viewer.jobRole === "marketing") return ["shots", "log"];
  const supportTeam = viewer.jobRole === "support" || viewer.arrangesStock;
  return SITE_VIEWS.filter(
    (view) => view !== "remind" || isManager(viewer.jobRole) || supportTeam,
  );
}

/** The asked-for tab if this person sees it, otherwise their first one. */
export function parseSiteView(
  value: string | string[] | undefined,
  views: readonly SiteView[],
): SiteView {
  return views.find((view) => view === value) ?? views[0] ?? "jobs";
}
