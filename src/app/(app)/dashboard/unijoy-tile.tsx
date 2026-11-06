import type { Profile } from "@/lib/auth/current-profile";
import { canChangeSettings } from "@/lib/auth/job-role";
import { yearPace } from "@/lib/domain/order-rollup";
import { formatQuantity } from "@/lib/format/quantity";
import { PaceBar, StatTile } from "./dashboard-parts";
import { loadUnijoyYear } from "./unijoy-data";
import { UnijoyTargetDialog } from "./unijoy-target-dialog";

/** Unijoy m² ordered this year against the yearly target, with the MD's way to key the target in. */
export async function UnijoyTile({
  me,
  today,
}: {
  me: Profile;
  today: string;
}) {
  const unijoy = await loadUnijoyYear(today);
  const { progress } = unijoy;
  return (
    <StatTile
      label={`Unijoy orders ${unijoy.year} (m²)`}
      value={formatQuantity(unijoy.m2)}
      note={
        progress
          ? `${progress.pct}% of ${formatQuantity(progress.target)} · ${formatQuantity(progress.remaining)} m² to go`
          : "No target set for this year yet."
      }
    >
      {progress ? (
        <PaceBar
          done={progress.m2}
          target={progress.target}
          pace={yearPace(today)}
          label="Unijoy orders against the yearly target"
          format={formatQuantity}
        />
      ) : null}
      {canChangeSettings(me) ? (
        <UnijoyTargetDialog year={unijoy.year} target={unijoy.target} />
      ) : null}
    </StatTile>
  );
}
