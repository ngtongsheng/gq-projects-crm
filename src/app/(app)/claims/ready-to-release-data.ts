import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadClaimPeople } from "./claim-people-data";
import { reportAllowsRelease } from "./travel-claim-status";

const submittedRows = z.array(
  z.object({ profile_id: z.uuid(), month: z.iso.date() }),
);
const reportRows = z.array(
  z.object({
    profile_id: z.uuid(),
    month: z.iso.date(),
    status: z.enum(["draft", "submitted", "reviewed", "approved"]),
  }),
);

/** Submitted claims of any month whose monthly report no longer holds them back (demo: submitted and tcRep). */
export async function countClaimsReadyToRelease(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("travel_claims")
    .select("profile_id, month")
    .eq("status", "submitted");
  if (error) throw new Error(`Could not load the claims: ${error.message}`);
  const submitted = submittedRows.parse(data);
  if (submitted.length === 0) return 0;

  const people = await loadClaimPeople();
  const { data: reports, error: reportError } = await supabase
    .from("monthly_reports")
    .select("profile_id, month, status")
    .in("profile_id", [...new Set(submitted.map((row) => row.profile_id))]);
  if (reportError) {
    throw new Error(`Could not load the reports: ${reportError.message}`);
  }
  const reportOf = new Map(
    reportRows
      .parse(reports)
      .map((row) => [`${row.profile_id}|${row.month}`, row.status]),
  );
  return submitted.filter((claim) => {
    const person = people.get(claim.profile_id);
    return (
      person?.active &&
      reportAllowsRelease(
        person.jobRole,
        reportOf.get(`${claim.profile_id}|${claim.month}`) ?? null,
      )
    );
  }).length;
}
