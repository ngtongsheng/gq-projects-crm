import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import {
  CLAIM_EXPENSE_TYPES,
  type ClaimSettings,
  claimCapsOn,
  claimFlags,
  claimPeriod,
  type FlagExpense,
} from "@/lib/domain/monthly-claim";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  loadHrRecords,
  loadOutstationRules,
  loadPackages,
  loadStandardPackages,
} from "../hr/staff-data";
import { loadLoggedDays } from "./claim-itinerary-data";
import { loadClaimSettings } from "./claim-settings-data";

export type ClaimFlags = ReturnType<typeof claimFlags> & {
  /** The person's monthly cap on petrol, toll and parking, from their HR package; null for none. */
  monthlyCap: number | null;
};

export type FlagTarget = {
  personId: string;
  jobRole: JobRole;
  month: CalendarDate;
  expenses: readonly FlagExpense[];
};

/**
 * Works out the warnings (D5) for other people's claims. The shared HR tables are read once;
 * only the MD and HR & Accounts can read them, which is who checks claims. The caps and
 * standards come out as warnings, never the salary.
 */
export async function createClaimFlagger(settings: ClaimSettings) {
  const supabase = await createClient();
  const [records, standards, outstation] = await Promise.all([
    loadHrRecords(supabase),
    loadStandardPackages(supabase),
    loadOutstationRules(supabase),
  ]);
  return async (target: FlagTarget): Promise<ClaimFlags> => {
    const [packages, loggedDays] = await Promise.all([
      loadPackages(supabase, target.personId),
      loadLoggedDays(
        target.personId,
        claimPeriod(target.month, settings.cutOffDay),
      ),
    ]);
    const basis = {
      person: {
        jobRole: target.jobRole,
        grade: records.get(target.personId)?.grade ?? null,
      },
      packages,
      standards,
      outstation,
    };
    const period = claimPeriod(target.month, settings.cutOffDay);
    return {
      ...claimFlags({
        month: target.month,
        expenses: target.expenses,
        loggedDays,
        settings,
        basis,
      }),
      monthlyCap: claimCapsOn(basis, period.to).monthlyCap,
    };
  };
}

const flagExpenseRows = z.array(
  z.object({
    id: z.uuid(),
    spent_on: z.iso.date(),
    expense_type: z.enum(CLAIM_EXPENSE_TYPES),
    amount: z.coerce.number(),
    km: z.coerce.number().nullable(),
    nights: z.number().nullable(),
  }),
);

export const toFlagExpenses = (data: unknown): FlagExpense[] =>
  flagExpenseRows.parse(data).map((row) => ({
    id: row.id,
    spentOn: row.spent_on,
    expenseType: row.expense_type,
    amount: row.amount,
    km: row.km,
    nights: row.nights,
  }));

export const FLAG_EXPENSE_COLUMNS =
  "id, spent_on, expense_type, amount, km, nights";

const personRow = z.object({ job_role: JobRole });

/** How many items on the claim are flagged, for the step actions that need a remark first. */
export async function loadClaimFlagCount(claim: {
  id: string;
  profileId: string;
  month: CalendarDate;
}): Promise<number> {
  const supabase = await createClient();
  const [expenses, person, settings] = await Promise.all([
    supabase
      .from("monthly_claim_expenses")
      .select(FLAG_EXPENSE_COLUMNS)
      .eq("claim_id", claim.id),
    supabase
      .from("profiles")
      .select("job_role")
      .eq("id", claim.profileId)
      .single(),
    loadClaimSettings(),
  ]);
  if (expenses.error) {
    throw new Error(`Could not load the expenses: ${expenses.error.message}`);
  }
  if (person.error) {
    throw new Error(`Could not load the person: ${person.error.message}`);
  }
  const flagsFor = await createClaimFlagger(settings);
  const flags = await flagsFor({
    personId: claim.profileId,
    jobRole: personRow.parse(person.data).job_role,
    month: claim.month,
    expenses: toFlagExpenses(expenses.data),
  });
  return flags.count;
}
