import type { JobRole } from "@/lib/auth/job-role";
import { sumRm } from "@/lib/format/money";

// Keys mirror is_allowance_list() in the hr migration (the demo's ALLOW_TYPES).
export const ALLOWANCE_TYPES = [
  "car",
  "motor_car",
  "office_parking",
  "fixed",
  "travel_car",
  "phone",
  "meal",
  "site",
  "others",
] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export const ALLOWANCE_LABEL: Record<AllowanceType, string> = {
  car: "Car allowance",
  motor_car: "Motor / car allowance",
  office_parking: "Office parking allowance",
  fixed: "Fixed allowance",
  travel_car: "Travel / car allowance",
  phone: "Phone allowance",
  meal: "Meal allowance",
  site: "Site allowance",
  others: "Others",
};

export const HOTEL_LEVELS = ["staff", "manager", "director"] as const;
export type HotelLevel = (typeof HOTEL_LEVELS)[number];

export const HOTEL_LEVEL_LABEL: Record<HotelLevel, string> = {
  staff: "Salesperson / site supervisor",
  manager: "Manager",
  director: "Director",
};

export type Allowance = { name: AllowanceType; amount: number };

/** One dated row of a person's package. A change is a new row; the history is never edited (loop 16 D4). */
export type StaffPackage = {
  id: string;
  profileId: string;
  effectiveOn: string;
  basic: number;
  allowances: Allowance[];
  /** Petrol + toll + parking claim max per month; null uses the standard package's. */
  claimCap: number | null;
  /** Null is automatic, see autoHotelLevel. */
  hotelLevel: HotelLevel | null;
  reason: string;
  addedBy: string;
};

/** The usual allowances and claim cap per position. */
export type StandardPackage = {
  allowances: Allowance[];
  claimCap: number | null;
};
export type StandardPosition = "sales" | "site";
export type StandardPackages = Record<StandardPosition, StandardPackage>;

export type OutstationRules = {
  breakfast: number;
  lunch: number;
  dinner: number;
  hotel: Record<HotelLevel, number>;
};

/** The package in force on a date: the latest row on or before it. Null before the first one. */
export function packageOn(
  history: readonly StaffPackage[],
  date: string,
): StaffPackage | null {
  let found: StaffPackage | null = null;
  for (const row of history) {
    if (
      row.effectiveOn <= date &&
      (found === null || row.effectiveOn > found.effectiveOn)
    ) {
      found = row;
    }
  }
  return found;
}

/** The next change after a date, if one is already recorded ("-> RM 4,000 from 1 Jan"). */
export function nextPackageAfter(
  history: readonly StaffPackage[],
  date: string,
): StaffPackage | null {
  let found: StaffPackage | null = null;
  for (const row of history) {
    if (
      row.effectiveOn > date &&
      (found === null || row.effectiveOn < found.effectiveOn)
    ) {
      found = row;
    }
  }
  return found;
}

export const allowanceTotal = (allowances: readonly Allowance[]): number =>
  sumRm(allowances.map((allowance) => allowance.amount));

/** Basic plus allowances for a month; bonus and commission are not part of a package. */
export const monthlyTotal = (row: StaffPackage): number =>
  sumRm([row.basic, allowanceTotal(row.allowances)]);

/** Salespeople and the Marketing Director use the salesperson package; Site Supervisors theirs; the rest have none. */
export function standardPositionOf(jobRole: JobRole): StandardPosition | null {
  if (jobRole === "site") return "site";
  return jobRole === "sales" || jobRole === "bd" ? "sales" : null;
}

/** The claim cap in force: the person's own, else their position's standard, else none. */
export function claimCapFor(
  jobRole: JobRole,
  row: StaffPackage | null,
  standards: StandardPackages,
): number | null {
  if (row?.claimCap != null) return row.claimCap;
  const position = standardPositionOf(jobRole);
  return position ? standards[position].claimCap : null;
}

const DIRECTOR_JOB_ROLES: readonly JobRole[] = ["md", "director", "bd"];
const MANAGER_GRADES: readonly string[] = ["M1", "M2"];

/** Directors automatically, then grade M1/M2 as a manager, everyone else staff (demo hotelLvl). */
export function autoHotelLevel(person: {
  jobRole: JobRole;
  grade: string | null;
}): HotelLevel {
  if (DIRECTOR_JOB_ROLES.includes(person.jobRole)) return "director";
  return person.grade !== null && MANAGER_GRADES.includes(person.grade)
    ? "manager"
    : "staff";
}

/** The level set on the package wins; otherwise the automatic one. */
export function hotelLevelFor(
  person: { jobRole: JobRole; grade: string | null },
  row: StaffPackage | null,
): HotelLevel {
  return row?.hotelLevel ?? autoHotelLevel(person);
}

export const hotelBudgetFor = (
  level: HotelLevel,
  rules: OutstationRules,
): number => rules.hotel[level];

/** Meals are a fixed allowance per day, no receipt. */
export const mealsPerDay = (rules: OutstationRules): number =>
  sumRm([rules.breakfast, rules.lunch, rules.dinner]);
