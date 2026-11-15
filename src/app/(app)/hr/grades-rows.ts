import { JobRoleLabel } from "@/lib/auth/job-role";
import { type AppendixStatus, appendixStatus } from "@/lib/domain/hr-scheme";
import { packageOn, type StaffPackage } from "@/lib/domain/staff-package";
import type { GradeRecord } from "./grades-data";
import type { SchemeGrade } from "./policy-data";
import type { StaffPerson } from "./staff-data";

/** Who the demo lists here: salespeople and directors, plus anyone HR has already given a grade. */
const SELLING_ROLES: readonly StaffPerson["jobRole"][] = [
  "sales",
  "bd",
  "director",
];

export type GradeRow = {
  personId: string;
  name: string;
  positionLabel: string;
  grade: string | null;
  /** The person's own package if one is recorded, else the grade's basic. */
  basic: number | null;
  basicFromPackage: boolean;
  gradeTarget: number | null;
  appendixSignedOn: string | null;
  appendixVersion: string | null;
  appendix: AppendixStatus;
};

export function buildGradeRows(input: {
  people: readonly StaffPerson[];
  packages: readonly StaffPackage[];
  records: ReadonlyMap<string, GradeRecord>;
  grades: readonly SchemeGrade[];
  schemeVersion: string | null;
  nameOf: (personId: string) => string;
  today: string;
}): GradeRow[] {
  const gradeOf = new Map(input.grades.map((grade) => [grade.grade, grade]));
  return input.people
    .filter(
      (person) =>
        SELLING_ROLES.includes(person.jobRole) ||
        input.records.get(person.id)?.grade,
    )
    .map((person): GradeRow => {
      const record = input.records.get(person.id);
      const grade = record?.grade ? gradeOf.get(record.grade) : undefined;
      const current = packageOn(
        input.packages.filter((row) => row.profileId === person.id),
        input.today,
      );
      return {
        personId: person.id,
        name: input.nameOf(person.id),
        positionLabel: JobRoleLabel[person.jobRole],
        grade: record?.grade ?? null,
        basic: current ? current.basic : (grade?.basic ?? null),
        basicFromPackage: current !== null,
        gradeTarget: grade?.annualTarget ?? null,
        appendixSignedOn: record?.appendixSignedOn ?? null,
        appendixVersion: record?.appendixVersion ?? null,
        appendix: appendixStatus(
          record?.appendixSignedOn ?? null,
          record?.appendixVersion ?? null,
          input.schemeVersion,
        ),
      };
    })
    .sort(
      (a, b) =>
        a.positionLabel.localeCompare(b.positionLabel) ||
        a.name.localeCompare(b.name),
    );
}
