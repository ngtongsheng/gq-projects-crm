import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { marginBand } from "@/lib/domain/costing";
import type { MarginLevel } from "../quote-view";

const BAND_TONE = { red: "bad", amber: "warn", green: "good" } as const;

/**
 * The margin with the demo's colours for people with the margin flag; everyone else sees only
 * Low or High margin (loop 13 D3), which is all the server sends them.
 */
export function MarginPill({
  costShown,
  margin,
  level,
}: {
  costShown: boolean;
  margin: number | null;
  level: MarginLevel;
}) {
  if (costShown) {
    if (margin === null)
      return <span className="text-muted-foreground">–</span>;
    const band = marginBand(margin);
    const tone: StatusTone = band ? BAND_TONE[band] : "neutral";
    return (
      <StatusBadge tone={tone}>
        <span className="font-mono tabular-nums">
          {(margin * 100).toFixed(1)}%
        </span>
      </StatusBadge>
    );
  }
  if (level === null) return <span className="text-muted-foreground">–</span>;
  return (
    <StatusBadge tone={level === "low" ? "bad" : "good"}>
      {level === "low" ? "Low margin" : "High margin"}
    </StatusBadge>
  );
}
