import {
  SITE_STAGE_LABEL,
  type SiteStage,
  siteStagePercent,
} from "@/lib/domain/site-stage";

/** The site stage as a label, a percentage and a bar. */
export function StageProgress({ stage }: { stage: SiteStage }) {
  const percent = siteStagePercent(stage);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{SITE_STAGE_LABEL[stage]}</span>
        <span className="font-mono text-muted-foreground tabular-nums">
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Site progress"
        className="h-2 overflow-hidden rounded-full bg-sunk"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
