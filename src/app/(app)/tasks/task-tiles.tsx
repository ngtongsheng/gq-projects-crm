import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import type { TaskTiles as Tiles } from "./task-view";

/** The person's own tiles, as on the demo's My tasks tab. */
export function TaskTiles({ tiles }: { tiles: Tiles }) {
  return (
    <TileGrid className="lg:grid-cols-4">
      <StatTile
        label="Overdue"
        value={
          <span className={tiles.overdue > 0 ? "text-bad" : undefined}>
            {tiles.overdue}
          </span>
        }
        note="Past the due date"
      />
      <StatTile
        label="Due this week"
        value={tiles.dueThisWeek}
        note="Including today"
      />
      <StatTile
        label="Revision required"
        value={tiles.revision}
        note="Sent back with comments"
      />
      <StatTile
        label="Waiting review"
        value={tiles.waitingReview}
        note="Submitted, not approved yet"
      />
    </TileGrid>
  );
}
