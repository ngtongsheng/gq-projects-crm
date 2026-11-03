import { StatusBadge } from "@/components/app/status-badge";
import { achievedTone } from "@/lib/domain/report-stats";

/** "12 / 50" with the share of target, coloured against how far through the month it is (`pace`, 0 to 1). */
export function TargetProgress({
  done,
  target,
  pace,
}: {
  done: number;
  target: number;
  pace: number;
}) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {done} / {target}
      {target > 0 && (
        <StatusBadge tone={achievedTone(done, target, pace)}>
          {Math.round((done / target) * 100)}%
        </StatusBadge>
      )}
    </span>
  );
}
