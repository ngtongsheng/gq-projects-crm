import type { Translate } from "@/lib/i18n/translate";
import { StatTile, TileGrid } from "../dashboard/dashboard-parts";
import type { TaskTiles as Tiles } from "./task-view";

/** The person's own tiles, as on the demo's My tasks tab. */
export function TaskTiles({ tiles, t }: { tiles: Tiles; t: Translate }) {
  return (
    <TileGrid className="lg:grid-cols-4">
      <StatTile
        label={t("Overdue")}
        value={
          <span className={tiles.overdue > 0 ? "text-bad" : undefined}>
            {tiles.overdue}
          </span>
        }
        note={t("Past the due date")}
      />
      <StatTile
        label={t("Due this week")}
        value={tiles.dueThisWeek}
        note={t("Including today")}
      />
      <StatTile
        label={t("Revision required")}
        value={tiles.revision}
        note={t("Sent back with comments")}
      />
      <StatTile
        label={t("Waiting review")}
        value={tiles.waitingReview}
        note={t("Submitted, not approved yet")}
      />
    </TileGrid>
  );
}
