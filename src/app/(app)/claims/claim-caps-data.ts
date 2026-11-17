import type { Profile } from "@/lib/auth/current-profile";
import type { ClaimCapBasis } from "@/lib/domain/claim-caps";
import type { OutstationRules } from "@/lib/domain/staff-package";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadHrRecords,
  loadOutstationRules,
  loadPackages,
  loadStandardPackages,
} from "../hr/staff-data";

export type ClaimCaps = {
  basis: ClaimCapBasis;
  /** The meal allowances; null when HR's rules could not be read. */
  meals: Pick<OutstationRules, "breakfast" | "lunch" | "dinner"> | null;
};

const NO_BASIS = (person: Profile): ClaimCapBasis => ({
  person: { jobRole: person.jobRole, grade: null },
  packages: [],
  standards: {
    sales: { allowances: [], claimCap: null },
    site: { allowances: [], claimCap: null },
  },
  outstation: {
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    hotel: { staff: 0, manager: 0, director: 0 },
  },
});

/**
 * The caps and meal allowances that apply to the signed-in person's own claim. HR's tables are
 * only readable by the MD and HR & Accounts, so this reads them with the service-role client
 * for this one person and passes on caps and allowances, never the salary. Without the service
 * key (a laptop) there are no caps, so no cap flags and the meals amount is keyed in.
 */
export async function loadOwnClaimCaps(person: Profile): Promise<ClaimCaps> {
  const admin = createAdminClient();
  if (!admin) return { basis: NO_BASIS(person), meals: null };

  const [packages, records, standards, outstation] = await Promise.all([
    loadPackages(admin, person.id),
    loadHrRecords(admin),
    loadStandardPackages(admin),
    loadOutstationRules(admin),
  ]);
  return {
    basis: {
      person: {
        jobRole: person.jobRole,
        grade: records.get(person.id)?.grade ?? null,
      },
      packages,
      standards,
      outstation,
    },
    meals: {
      breakfast: outstation.breakfast,
      lunch: outstation.lunch,
      dinner: outstation.dinner,
    },
  };
}
