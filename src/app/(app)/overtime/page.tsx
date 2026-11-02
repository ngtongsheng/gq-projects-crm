import { Moon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { canDecideOvertime, isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { otTotals } from "@/lib/domain/ot-claim";
import { todayMyt } from "@/lib/format/date";
import { OtClaimCard } from "./ot-claim-card";
import { OtClaimDialog } from "./ot-claim-dialog";
import { loadMofOptions, loadOtClaims, type OtClaim } from "./overtime-data";

export const metadata: Metadata = { title: "Overtime" };

function Totals({ claims }: { claims: OtClaim[] }) {
  const totals = otTotals(claims);
  return (
    <p className="font-mono text-sm text-muted-foreground tabular-nums">
      {totals.ot} hrs OT claim · {totals.replacementLeave} hrs replacement leave
      · {totals.pending} hrs pending
    </p>
  );
}

export default async function OvertimePage() {
  const me = await requireSection("overtime");
  const [claims, mofs, team] = await Promise.all([
    loadOtClaims(),
    loadMofOptions(),
    getTeamDirectory(),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const mine = claims.filter((claim) => claim.profileId === me.id);
  const others = claims.filter((claim) => claim.profileId !== me.id);
  // Pending first so the approver sees what is waiting.
  const teamClaims = [...others].sort(
    (a, b) =>
      Number(b.status === "pending") - Number(a.status === "pending") ||
      b.workDate.localeCompare(a.workDate),
  );
  const canDecide = canDecideOvertime(me.jobRole);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overtime"
        description="Night and weekend work. The MD or Sales Director approves each entry."
        actions={<OtClaimDialog mofs={mofs} today={todayMyt()} />}
      />

      {isManager(me.jobRole) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">
            {canDecide ? "Team overtime to approve" : "Team overtime"}
          </h2>
          <Totals claims={others} />
          {teamClaims.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={Moon}
                title="No overtime from the team yet"
                description="Claims appear here as people file them."
              />
            </div>
          ) : (
            teamClaims.map((claim) => (
              <OtClaimCard
                key={claim.id}
                claim={claim}
                personName={nameOf.get(claim.profileId) ?? "Unnamed"}
                canDecide={canDecide}
                decidedByName={
                  claim.decidedBy ? nameOf.get(claim.decidedBy) : undefined
                }
              />
            ))
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">My overtime</h2>
        <Totals claims={mine} />
        {mine.length === 0 ? (
          <div className="rounded-xl border bg-card">
            <EmptyState
              icon={Moon}
              title="No overtime filed"
              description="Add overtime after night or weekend work."
            />
          </div>
        ) : (
          mine.map((claim) => (
            <OtClaimCard
              key={claim.id}
              claim={claim}
              decidedByName={
                claim.decidedBy ? nameOf.get(claim.decidedBy) : undefined
              }
            />
          ))
        )}
      </section>
    </div>
  );
}
