import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { CLAIM_STATUSES } from "@/lib/domain/claim-flow";
import { type ClaimSettings, claimMonthOf } from "@/lib/domain/monthly-claim";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { sumRm, toCents } from "@/lib/format/money";
import { createClient } from "@/lib/supabase/server";
import { loadClaimPeople } from "./claim-people-data";
import { createClaimFlagger, toFlagExpenses } from "./claim-review-flags";

const monthRows = z.array(z.object({ month: z.iso.date() }));

/** The months that have a submitted claim, newest first, always with the claim month now. */
export async function loadClaimMonths(
  settings: Pick<ClaimSettings, "cutOffDay">,
): Promise<CalendarDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select("month")
    .neq("status", "draft")
    .order("month", { ascending: false })
    .limit(300);
  if (error)
    throw new Error(`Could not load the claim months: ${error.message}`);
  const now = claimMonthOf(todayMyt(), settings.cutOffDay);
  return [
    ...new Set([now, ...monthRows.parse(data).map((row) => row.month)]),
  ].sort((a, b) => b.localeCompare(a));
}

const amountPair = z.object({
  amount: z.coerce.number(),
  original_amount: z.coerce.number(),
});

const claimRows = z.array(
  z.object({
    id: z.uuid(),
    profile_id: z.uuid(),
    status: z.enum(CLAIM_STATUSES),
    remark: z.string(),
    original_receipts_received: z.boolean(),
    ot_original_amount: z.coerce.number().nullable(),
    ot_amount: z.coerce.number().nullable(),
    monthly_claim_commissions: z.array(amountPair),
    monthly_claim_expenses: z.array(
      amountPair.extend({
        id: z.uuid(),
        spent_on: z.iso.date(),
        expense_type: z.string(),
        km: z.coerce.number().nullable(),
        nights: z.number().nullable(),
        receipt_path: z.string().nullable(),
      }),
    ),
    monthly_claim_log: z.array(
      z.object({ status: z.string(), changed_at: z.string() }),
    ),
  }),
);

export type ClaimListRow = {
  id: string;
  personId: string;
  name: string;
  jobRole: JobRole;
  status: (typeof CLAIM_STATUSES)[number];
  commission: number;
  expenses: number;
  expenseCount: number;
  receiptCount: number;
  originalReceiptsReceived: boolean;
  /** In ringgit, frozen at submit. */
  otAmount: number;
  /** When it was last submitted, as a timestamp. */
  submittedAt: string | null;
  adjusted: boolean;
  hasRemark: boolean;
  /** Items to check; counted while it waits for HR & Accounts (demo: only Submitted). */
  flagCount: number;
};

/** Order of the MD's list: what waits for their approval first (demo ORD). */
const MD_ORDER = ["checked", "submitted", "returned", "approved", "paid"];

/** Every submitted claim for a month with its totals and, while submitted, the number of flagged items. */
export async function loadClaimsForMonth(
  month: CalendarDate,
  settings: ClaimSettings,
  viewerIsMd: boolean,
): Promise<ClaimListRow[]> {
  const supabase = await createClient();
  const people = await loadClaimPeople();
  const { data, error } = await supabase
    .from("monthly_claims")
    .select(
      "id, profile_id, status, remark, original_receipts_received, ot_original_amount, ot_amount, monthly_claim_commissions(amount, original_amount), monthly_claim_expenses(id, spent_on, expense_type, km, nights, amount, original_amount, receipt_path), monthly_claim_log(status, changed_at)",
    )
    .eq("month", month)
    .neq("status", "draft");
  if (error) throw new Error(`Could not load the claims: ${error.message}`);
  const claims = claimRows.parse(data).flatMap((claim) => {
    const person = people.get(claim.profile_id);
    return person ? [{ ...claim, person }] : [];
  });

  const submitted = claims.filter((claim) => claim.status === "submitted");
  const flagsFor =
    submitted.length > 0 ? await createClaimFlagger(settings) : null;
  const flagCounts = new Map<string, number>();
  if (flagsFor) {
    await Promise.all(
      submitted.map(async (claim) => {
        const flags = await flagsFor({
          personId: claim.profile_id,
          jobRole: claim.person.jobRole,
          month,
          expenses: toFlagExpenses(claim.monthly_claim_expenses),
        });
        flagCounts.set(claim.id, flags.count);
      }),
    );
  }

  const rows = claims.map((claim): ClaimListRow => {
    const lines = [
      ...claim.monthly_claim_commissions,
      ...claim.monthly_claim_expenses,
    ];
    return {
      id: claim.id,
      personId: claim.profile_id,
      name: claim.person.name,
      jobRole: claim.person.jobRole,
      status: claim.status,
      commission: sumRm(claim.monthly_claim_commissions.map((l) => l.amount)),
      expenses: sumRm(claim.monthly_claim_expenses.map((l) => l.amount)),
      expenseCount: claim.monthly_claim_expenses.length,
      receiptCount: claim.monthly_claim_expenses.filter(
        (l) => l.receipt_path !== null,
      ).length,
      originalReceiptsReceived: claim.original_receipts_received,
      otAmount: claim.ot_amount ?? 0,
      submittedAt:
        claim.monthly_claim_log
          .filter((entry) => entry.status === "submitted")
          .map((entry) => entry.changed_at)
          .sort()
          .at(-1) ?? null,
      adjusted:
        lines.some((l) => toCents(l.amount) !== toCents(l.original_amount)) ||
        toCents(claim.ot_amount ?? 0) !==
          toCents(claim.ot_original_amount ?? 0),
      hasRemark: claim.remark.trim() !== "",
      flagCount: flagCounts.get(claim.id) ?? 0,
    };
  });
  return rows.sort(
    (a, b) =>
      (viewerIsMd
        ? MD_ORDER.indexOf(a.status) - MD_ORDER.indexOf(b.status)
        : 0) || a.name.localeCompare(b.name),
  );
}

/** Active people who file a claim and have none submitted for the month, by name. */
export async function loadMissingClaimants(
  submittedPersonIds: ReadonlySet<string>,
): Promise<string[]> {
  const people = await loadClaimPeople();
  return [...people.values()]
    .filter(
      (person) =>
        person.active &&
        canFileClaim({ jobRole: person.jobRole, sells: person.sells }) &&
        !submittedPersonIds.has(person.id),
    )
    .map((person) => person.name)
    .sort((a, b) => a.localeCompare(b));
}
