import type { JobRole } from "@/lib/auth/job-role";
import { claimCapsOn } from "@/lib/domain/claim-caps";
import type { CalendarDate } from "@/lib/format/date";
import {
  loadHrRecords,
  loadOutstationRules,
  loadPackages,
  loadStandardPackages,
} from "../hr/staff-data";

/**
 * Each person's monthly petrol, parking and toll limit on a date (demo clCap), by person id; null
 * for none. Only the MD and HR & Accounts can read HR's tables, which is who checks claims.
 */
export async function loadMonthlyLimits(
  people: readonly { id: string; jobRole: JobRole }[],
  date: CalendarDate,
): Promise<Map<string, number | null>> {
  const [packages, records, standards, outstation] = await Promise.all([
    loadPackages(),
    loadHrRecords(),
    loadStandardPackages(),
    loadOutstationRules(),
  ]);
  return new Map(
    people.map((person) => [
      person.id,
      claimCapsOn(
        {
          person: {
            jobRole: person.jobRole,
            grade: records.get(person.id)?.grade ?? null,
          },
          packages: packages.filter((row) => row.profileId === person.id),
          standards,
          outstation,
        },
        date,
      ).monthlyCap,
    ]),
  );
}
