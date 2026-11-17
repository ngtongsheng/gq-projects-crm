import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { claimPeriod } from "@/lib/domain/claim-month";
import { type ReportStatus, reportKindFor } from "@/lib/domain/report-stats";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadMonthlyLimits } from "./claim-limits-data";
import { loadClaimPeople } from "./claim-people-data";
import {
  parseTravelClaims,
  TRAVEL_CLAIM_COLUMNS,
  type TravelClaim,
} from "./travel-claim-data";
import { reportAllowsRelease } from "./travel-claim-status";

export type TravelClaimListRow = {
  personId: string;
  name: string;
  jobRole: JobRole;
  /** Null when the person has not started one: the list still shows their row. */
  claim: TravelClaim | null;
  releasedByName: string | null;
  /** Petrol, parking and toll limit from HR; null for none. */
  monthlyLimit: number | null;
  /** Null when no report was started, and for roles that file none. */
  report: ReportStatus | null;
  filesReport: boolean;
  /** The report no longer holds the claim back (demo tcRep). */
  reportIsIn: boolean;
};

const reportRows = z.array(
  z.object({
    profile_id: z.uuid(),
    status: z.enum(["draft", "submitted", "reviewed", "approved"]),
  }),
);

/** Every active person who files a travel claim, in name order, with their claim and monthly report for a claim month. */
export async function loadTravelClaimRows(
  month: CalendarDate,
  cutOffDay: number,
): Promise<TravelClaimListRow[]> {
  const everyone = await loadClaimPeople();
  const people = [...everyone.values()]
    .filter((person) => person.active && canFileClaim(person))
    .sort((a, b) => a.name.localeCompare(b.name));
  const supabase = await createClient();
  const [claims, reports, limits] = await Promise.all([
    supabase
      .from("travel_claims")
      .select(TRAVEL_CLAIM_COLUMNS)
      .eq("month", month),
    supabase
      .from("monthly_reports")
      .select("profile_id, status")
      .eq("month", month)
      .in(
        "profile_id",
        people.map((person) => person.id),
      ),
    loadMonthlyLimits(people, claimPeriod(month, cutOffDay).to),
  ]);
  if (claims.error) {
    throw new Error(`Could not load the claims: ${claims.error.message}`);
  }
  if (reports.error) {
    throw new Error(`Could not load the reports: ${reports.error.message}`);
  }
  const claimOf = new Map(
    parseTravelClaims(claims.data).map((claim) => [claim.personId, claim]),
  );
  const reportOf = new Map(
    reportRows.parse(reports.data).map((row) => [row.profile_id, row.status]),
  );

  return people.map((person) => {
    const claim = claimOf.get(person.id) ?? null;
    const report = reportOf.get(person.id) ?? null;
    return {
      personId: person.id,
      name: person.name,
      jobRole: person.jobRole,
      claim,
      releasedByName: claim?.releasedBy
        ? (everyone.get(claim.releasedBy)?.name ?? null)
        : null,
      monthlyLimit: limits.get(person.id) ?? null,
      report,
      filesReport: reportKindFor(person.jobRole) !== null,
      reportIsIn: reportAllowsRelease(person.jobRole, report),
    };
  });
}
