import { JobRoleLabel } from "@/lib/auth/job-role";
import {
  autoHotelLevel,
  claimCapFor,
  monthlyTotal,
  nextPackageAfter,
  type OutstationRules,
  packageOn,
  type StaffPackage,
  type StandardPackages,
  standardPositionOf,
} from "@/lib/domain/staff-package";
import { sumRm } from "@/lib/format/money";
import type { StaffHrRecord, StaffPerson } from "./staff-data";
import type { StaffSheet } from "./staff-package-dialog";

const NO_RECORD: StaffHrRecord = {
  grade: null,
  confirmedOn: null,
  offerLetterLink: null,
  note: "",
};

export const STANDARD_TITLE = {
  sales: "Salesperson package",
  site: "Site supervisor package",
} as const;

export type StaffRow = {
  personId: string;
  name: string;
  positionLabel: string;
  joinedOn: string | null;
  confirmedOn: string | null;
  current: StaffPackage | null;
  /** A change already recorded for a later date. */
  next: StaffPackage | null;
  changes: number;
  claimCap: number | null;
  sheet: StaffSheet;
};

/** One row per person still here, with the package in force today and what their sheet opens with. */
export function buildStaffRows(input: {
  people: readonly StaffPerson[];
  packages: readonly StaffPackage[];
  records: ReadonlyMap<string, StaffHrRecord>;
  standards: StandardPackages;
  outstation: OutstationRules;
  nameOf: (personId: string) => string;
  today: string;
}): { rows: StaffRow[]; withoutPackage: number; monthlyTotal: number } {
  const { standards, outstation, nameOf, today } = input;
  const historyOf = new Map<string, StaffPackage[]>();
  for (const row of input.packages) {
    historyOf.set(row.profileId, [
      ...(historyOf.get(row.profileId) ?? []),
      row,
    ]);
  }

  const rows = input.people
    .map((person): StaffRow => {
      const history = historyOf.get(person.id) ?? [];
      const current = packageOn(history, today);
      const record = input.records.get(person.id) ?? NO_RECORD;
      const standardPosition = standardPositionOf(person.jobRole);
      const level = autoHotelLevel({
        jobRole: person.jobRole,
        grade: record.grade,
      });
      const positionLabel = JobRoleLabel[person.jobRole];
      return {
        personId: person.id,
        name: nameOf(person.id),
        positionLabel,
        joinedOn: person.joinedOn,
        confirmedOn: record.confirmedOn,
        current,
        next: nextPackageAfter(history, today),
        changes: history.length,
        claimCap: claimCapFor(person.jobRole, current, standards),
        sheet: {
          personId: person.id,
          name: nameOf(person.id),
          positionLabel,
          joinedOn: person.joinedOn,
          history: [...history]
            .sort((a, b) => b.effectiveOn.localeCompare(a.effectiveOn))
            .map((entry) => ({ ...entry, addedByName: nameOf(entry.addedBy) })),
          currentId: current?.id ?? null,
          details: {
            confirmedOn: record.confirmedOn,
            offerLetterLink: record.offerLetterLink,
            note: record.note,
          },
          standard: standardPosition
            ? {
                title: STANDARD_TITLE[standardPosition],
                package: standards[standardPosition],
              }
            : null,
          autoHotelLevel: level,
          hotelBudget: outstation.hotel,
          today,
        },
      };
    })
    .sort(
      (a, b) =>
        a.positionLabel.localeCompare(b.positionLabel) ||
        a.name.localeCompare(b.name),
    );

  return {
    rows,
    withoutPackage: rows.filter((row) => row.current === null).length,
    monthlyTotal: sumRm(
      rows.map((row) => (row.current ? monthlyTotal(row.current) : 0)),
    ),
  };
}
