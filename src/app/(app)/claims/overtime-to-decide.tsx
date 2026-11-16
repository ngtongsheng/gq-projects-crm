import { Moon } from "lucide-react";
import type { Profile } from "@/lib/auth/current-profile";
import { canDecideOvertime } from "@/lib/auth/job-role";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { otTotals } from "@/lib/domain/ot-claim";
import type { Translate } from "@/lib/i18n/translate";
import { OtClaimCard } from "../overtime/ot-claim-card";
import { loadOtClaims } from "../overtime/overtime-data";

/**
 * Overtime waiting for a decision (D3), shown at the top of Claims for the people who approve it.
 * Overtime reaches a claim only once approved, so entries with no claim yet are decided here.
 */
export async function OvertimeToDecide({
  me,
  t,
}: {
  me: Profile;
  t: Translate;
}) {
  if (!canDecideOvertime(me.jobRole)) return null;
  const [claims, team] = await Promise.all([
    loadOtClaims(),
    getTeamDirectory(),
  ]);
  // The database hides a claim you filed yourself from a decision, so leave your own out.
  const waiting = claims
    .filter((claim) => claim.status === "pending" && claim.profileId !== me.id)
    .sort((a, b) => a.workDate.localeCompare(b.workDate));
  if (waiting.length === 0) return null;
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Moon className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="font-heading text-lg font-semibold">
          {t("Overtime to decide")}
        </h2>
        <span className="text-sm text-muted-foreground">
          {otTotals(waiting).pending} {t("hrs waiting")}
        </span>
      </div>
      {waiting.map((claim) => (
        <OtClaimCard
          key={claim.id}
          claim={claim}
          personName={nameOf.get(claim.profileId) ?? "Unnamed"}
          canDecide
        />
      ))}
    </section>
  );
}
