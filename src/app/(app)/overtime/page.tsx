import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { canDecideOvertime, isManager } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  isSameMonth,
  shiftMonth,
  startOfMonth,
} from "@/lib/domain/calendar-grid";
import { otTotals } from "@/lib/domain/ot-claim";
import { formatMonth, todayMyt } from "@/lib/format/date";
import { OtClaimCard } from "./ot-claim-card";
import { OtClaimDialog } from "./ot-claim-dialog";
import { loadMofOptions, loadOtClaims, type OtClaim } from "./overtime-data";

export const metadata: Metadata = { title: "Overtime" };

const monthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((month) => `${month}-01`)
  .optional()
  .catch(undefined);

const monthHref = (month: string) => `/overtime?month=${month.slice(0, 7)}`;

function Totals({ claims }: { claims: OtClaim[] }) {
  const totals = otTotals(claims);
  return (
    <p className="font-mono text-sm text-muted-foreground tabular-nums">
      {totals.ot} hrs OT claim · {totals.replacementLeave} hrs replacement leave
      · {totals.pending} hrs pending
    </p>
  );
}

export default async function OvertimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSection("overtime");
  const today = todayMyt();
  const current = startOfMonth(today);
  const asked = monthParam.parse((await searchParams).month);
  // Overtime is read one month at a time; a month still to come shows the current one.
  const month = asked && asked <= current ? asked : current;

  const [allClaims, mofs, team] = await Promise.all([
    loadOtClaims(),
    loadMofOptions(),
    getTeamDirectory(),
  ]);
  const claims = allClaims.filter((claim) =>
    isSameMonth(claim.workDate, month),
  );
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

  // Hours for each person this month, so the month can be read at a glance.
  const people = [...new Set(others.map((claim) => claim.profileId))]
    .map((id) => ({
      id,
      name: nameOf.get(id) ?? "Unnamed",
      totals: otTotals(others.filter((claim) => claim.profileId === id)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overtime"
        description="Night and weekend work, one month at a time. The MD or Sales Director approves each entry."
        actions={<OtClaimDialog mofs={mofs} today={today} />}
      />

      <div className="flex items-center gap-1">
        <Button
          asChild
          variant="outline"
          size="icon"
          aria-label="Previous month"
        >
          <Link href={monthHref(shiftMonth(month, -1))}>
            <ChevronLeft />
          </Link>
        </Button>
        <span className="min-w-24 text-center font-mono text-sm tabular-nums">
          {formatMonth(month)}
        </span>
        {month < current ? (
          <Button asChild variant="outline" size="icon" aria-label="Next month">
            <Link href={monthHref(shiftMonth(month, 1))}>
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            disabled
          >
            <ChevronRight />
          </Button>
        )}
      </div>

      {isManager(me.jobRole) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-lg font-semibold">
            {canDecide ? "Team overtime to approve" : "Team overtime"}
          </h2>
          <Totals claims={others} />
          {people.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <span className="font-medium">{person.name}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {person.totals.ot} hrs OT · {person.totals.replacementLeave}{" "}
                    hrs replacement leave · {person.totals.pending} hrs pending
                  </span>
                </li>
              ))}
            </ul>
          )}
          {teamClaims.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={Moon}
                title={`No overtime from the team in ${formatMonth(month)}`}
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
              title={`No overtime filed in ${formatMonth(month)}`}
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
