import type { JobRole } from "@/lib/auth/job-role";
import type { CalendarDate } from "@/lib/format/date";
import {
  claimCapFor,
  hotelBudgetFor,
  hotelLevelFor,
  type OutstationRules,
  packageOn,
  type StaffPackage,
  type StandardPackages,
} from "./staff-package";

/** Who the claim is for and the HR records its caps come from (D4). */
export type ClaimCapBasis = {
  person: { jobRole: JobRole; grade: string | null };
  packages: readonly StaffPackage[];
  standards: StandardPackages;
  outstation: OutstationRules;
};

/** The caps in force on a date, from the HR package then. Null is no cap; a cap of 0 is none too (demo). */
export function claimCapsOn(
  basis: ClaimCapBasis,
  date: CalendarDate,
): { monthlyCap: number | null; hotelBudget: number | null } {
  const row = packageOn(basis.packages, date);
  const monthlyCap = claimCapFor(basis.person.jobRole, row, basis.standards);
  const hotelBudget = hotelBudgetFor(
    hotelLevelFor(basis.person, row),
    basis.outstation,
  );
  return {
    monthlyCap: monthlyCap ? monthlyCap : null,
    hotelBudget: hotelBudget ? hotelBudget : null,
  };
}
