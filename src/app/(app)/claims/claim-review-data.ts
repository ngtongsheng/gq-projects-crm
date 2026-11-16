import { z } from "zod";
import { lastMonthOf, type ReportStatus } from "@/lib/domain/claim-flow";
import { claimPeriod } from "@/lib/domain/monthly-claim";
import { reportKindFor } from "@/lib/domain/report-stats";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { loadClaimOvertime } from "./claim-ot-data";
import { loadClaimPeople } from "./claim-people-data";
import { createClaimFlagger } from "./claim-review-flags";
import { loadClaimSettings } from "./claim-settings-data";
import { claimHead, HEAD_COLUMNS, loadClaimLines } from "./my-claim-data";

const reviewRow = z.object({
  id: z.uuid(),
  profile_id: z.uuid(),
  month: z.iso.date(),
  monthly_claim_log: z.array(
    z.object({ status: z.string(), changed_at: z.string() }),
  ),
});

const reportRow = z
  .object({ status: z.enum(["draft", "submitted", "reviewed", "approved"]) })
  .nullable();

const keyRows = z.array(z.object({ mof_id: z.uuid() }));

/**
 * Everything the MD or HR & Accounts needs to settle one claim: the claim as submitted, the
 * warnings (D5), last month's report for the submit gate, the report for the pay gate, and the
 * orders whose late-collection cut a special approval waived. Null when the claim is not
 * theirs to see (the database hides it).
 */
export async function loadClaimReview(claimId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select(
      `${HEAD_COLUMNS}, profile_id, month, monthly_claim_log(status, changed_at)`,
    )
    .eq("id", claimId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the claim: ${error.message}`);
  if (!data) return null;
  const head = claimHead.parse(data);
  const row = reviewRow.parse(data);
  const person = (await loadClaimPeople()).get(row.profile_id);
  if (!person) return null;
  const month: CalendarDate = row.month;
  const settings = await loadClaimSettings();
  const period = claimPeriod(month, settings.cutOffDay);
  const kind = reportKindFor(person.jobRole);

  const [lines, overtime, appeals, flagsFor, lastMonth, thisMonth] =
    await Promise.all([
      loadClaimLines(supabase, head.id),
      loadClaimOvertime(row.profile_id, period, head.id),
      supabase
        .from("commission_appeals")
        .select("mof_id")
        .eq("profile_id", row.profile_id)
        .eq("status", "approved"),
      createClaimFlagger(settings),
      reportStatusFor(supabase, kind, row.profile_id, lastMonthOf(month)),
      reportStatusFor(supabase, kind, row.profile_id, month),
    ]);
  if (appeals.error) {
    throw new Error(`Could not load the appeals: ${appeals.error.message}`);
  }
  const flags = await flagsFor({
    personId: row.profile_id,
    jobRole: person.jobRole,
    month,
    expenses: lines.expenses,
  });

  return {
    head,
    personId: row.profile_id,
    personName: person.name,
    jobRole: person.jobRole,
    month,
    period,
    settings,
    submittedAt:
      row.monthly_claim_log
        .filter((entry) => entry.status === "submitted")
        .map((entry) => entry.changed_at)
        .sort()
        .at(-1) ?? null,
    ...lines,
    overtime,
    flags,
    approvedAppealMofIds: new Set(
      keyRows.parse(appeals.data).map((r) => r.mof_id),
    ),
    /** Null when the person files no monthly report. */
    lastMonthReport: kind ? lastMonth : null,
    claimMonthReport: kind ? thisMonth : null,
    filesReport: kind !== null,
  };
}

async function reportStatusFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kind: ReturnType<typeof reportKindFor>,
  personId: string,
  month: CalendarDate,
): Promise<ReportStatus | null> {
  if (!kind) return null;
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("status")
    .eq("profile_id", personId)
    .eq("month", month)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load the monthly report: ${error.message}`);
  }
  return reportRow.parse(data)?.status ?? null;
}
