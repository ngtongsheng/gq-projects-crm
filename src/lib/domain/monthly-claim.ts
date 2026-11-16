import { z } from "zod";
import type { JobRole } from "@/lib/auth/job-role";
import { addDays, type CalendarDate } from "@/lib/format/date";
import { fromCents, sumRm, toCents } from "@/lib/format/money";
import {
  claimCapFor,
  hotelBudgetFor,
  hotelLevelFor,
  type OutstationRules,
  packageOn,
  type StaffPackage,
  type StandardPackages,
} from "./staff-package";

// Mirrors app_settings_claims_check in the monthly claims migration.
export const ClaimSettings = z.object({
  cutOffDay: z
    .number({ error: "Enter the cut-off day as a number." })
    .int("Enter the cut-off day as a whole day.")
    .min(1, "The cut-off day must be between 1 and 28.")
    .max(28, "The cut-off day must be between 1 and 28."),
  mileageRatePerKm: z
    .number({ error: "Enter the mileage rate as a number." })
    .min(0, "The mileage rate can't be below RM 0.")
    .max(10, "The mileage rate can't be over RM 10 per km."),
  kmPerDay: z
    .number({ error: "Enter the km per day as a number." })
    .positive("The km per day must be above 0."),
  /** 0 means no monthly travel limit. */
  monthlyTravelLimit: z
    .number({ error: "Enter the monthly travel limit as a number." })
    .min(0, "The monthly travel limit can't be below RM 0."),
  needReport: z.boolean(),
});
export type ClaimSettings = z.infer<typeof ClaimSettings>;

// Values mirror the expense_type check in the monthly claims migration.
export const CLAIM_EXPENSE_TYPES = [
  "petrol",
  "toll",
  "parking",
  "outstation_meals",
  "hotel",
  "mileage",
  "grab",
  "others",
] as const;
export type ClaimExpenseType = (typeof CLAIM_EXPENSE_TYPES)[number];

/** What the monthly claim cap covers (the HR package's "petrol + toll + parking claim max"). */
const CAPPED_EXPENSE_TYPES: readonly ClaimExpenseType[] = [
  "petrol",
  "toll",
  "parking",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** The first day of the month after the one a date falls in. */
function nextMonthStart(date: CalendarDate): CalendarDate {
  const [year, month] = date.split("-").map(Number);
  return month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
}

/** The claim month (its first day) a date belongs to: days after the cut-off roll into the next month. */
export function claimMonthOf(
  date: CalendarDate,
  cutOffDay: number,
): CalendarDate {
  const day = Number(date.slice(8, 10));
  return day <= cutOffDay ? `${date.slice(0, 8)}01` : nextMonthStart(date);
}

/** The days a claim month covers: the day after last month's cut-off up to this month's. */
export function claimPeriod(
  month: CalendarDate,
  cutOffDay: number,
): { from: CalendarDate; to: CalendarDate } {
  const previousMonth = addDays(month, -1).slice(0, 8);
  return {
    from: addDays(`${previousMonth}${pad(cutOffDay)}`, 1),
    to: `${month.slice(0, 8)}${pad(cutOffDay)}`,
  };
}

/** Km times the rate, rounded to the sen like the database does. */
export const mileageAmount = (km: number, ratePerKm: number): number =>
  fromCents(toCents(km * ratePerKm));

/** A claimed amount next to what the checker approved. */
export type ClaimAmount = { originalAmount: number; amount: number };

export type SectionTotal = { original: number; final: number };

const sectionTotal = (lines: readonly ClaimAmount[]): SectionTotal => ({
  original: sumRm(lines.map((line) => line.originalAmount)),
  final: sumRm(lines.map((line) => line.amount)),
});

/**
 * Totals per section and for the claim. Section C is the frozen OT once submitted, or the
 * month's approved OT before that.
 */
export function claimTotals(claim: {
  commissions: readonly ClaimAmount[];
  expenses: readonly ClaimAmount[];
  ot: ClaimAmount;
}) {
  const commission = sectionTotal(claim.commissions);
  const expenses = sectionTotal(claim.expenses);
  const ot = sectionTotal([claim.ot]);
  const original = sumRm([commission.original, expenses.original, ot.original]);
  const final = sumRm([commission.final, expenses.final, ot.final]);
  return {
    commission,
    expenses,
    ot,
    original,
    final,
    /** Final minus original; negative when the checker cut the claim. */
    difference: sumRm([final, -original]),
  };
}

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

export type FlagExpense = {
  id: string;
  spentOn: CalendarDate;
  expenseType: ClaimExpenseType;
  amount: number;
  km: number | null;
  nights: number | null;
};

export type ExpenseFlag =
  | { kind: "no_visit" }
  | { kind: "hotel_over_budget"; perNight: number; budget: number }
  | { kind: "meals_twice" }
  | { kind: "km_over_day"; km: number; kmPerDay: number };

export type MonthlyFlag =
  | { kind: "monthly_cap"; used: number; cap: number; over: number }
  | { kind: "travel_limit"; total: number; limit: number; over: number };

const tenths = (km: number) => Math.round(km * 10);

/**
 * D5: warnings for the checker, never a block. Each line can be flagged for no visit or site
 * work logged that day, a hotel night over budget, meals claimed twice in a day or more km in
 * a day than the standard; the claim for petrol, toll and parking over the person's monthly
 * cap, or else all travel over the monthly limit.
 */
export function claimFlags(input: {
  month: CalendarDate;
  expenses: readonly FlagExpense[];
  /** Days with a visit or site work logged by the person. */
  loggedDays: ReadonlySet<CalendarDate>;
  settings: Pick<
    ClaimSettings,
    "cutOffDay" | "kmPerDay" | "monthlyTravelLimit"
  >;
  basis: ClaimCapBasis;
}): {
  byExpense: Map<string, ExpenseFlag[]>;
  monthly: MonthlyFlag | null;
  count: number;
} {
  const { expenses, settings } = input;
  const kmByDay = new Map<CalendarDate, number>();
  const mealsByDay = new Map<CalendarDate, number>();
  for (const expense of expenses) {
    if (expense.km !== null) {
      kmByDay.set(
        expense.spentOn,
        (kmByDay.get(expense.spentOn) ?? 0) + tenths(expense.km),
      );
    }
    if (expense.expenseType === "outstation_meals") {
      mealsByDay.set(
        expense.spentOn,
        (mealsByDay.get(expense.spentOn) ?? 0) + 1,
      );
    }
  }

  const byExpense = new Map<string, ExpenseFlag[]>();
  for (const expense of expenses) {
    const flags: ExpenseFlag[] = [];
    if (!input.loggedDays.has(expense.spentOn))
      flags.push({ kind: "no_visit" });
    if (expense.expenseType === "hotel") {
      const nights = expense.nights ?? 1;
      const { hotelBudget } = claimCapsOn(input.basis, expense.spentOn);
      if (
        hotelBudget !== null &&
        toCents(expense.amount) > toCents(hotelBudget) * nights
      ) {
        flags.push({
          kind: "hotel_over_budget",
          perNight: fromCents(toCents(expense.amount / nights)),
          budget: hotelBudget,
        });
      }
    }
    if ((mealsByDay.get(expense.spentOn) ?? 0) > 1) {
      flags.push({ kind: "meals_twice" });
    }
    const dayKm = kmByDay.get(expense.spentOn) ?? 0;
    if (expense.km !== null && dayKm > tenths(settings.kmPerDay)) {
      flags.push({
        kind: "km_over_day",
        km: dayKm / 10,
        kmPerDay: settings.kmPerDay,
      });
    }
    if (flags.length > 0) byExpense.set(expense.id, flags);
  }

  const monthly = monthlyFlag(input);
  return {
    byExpense,
    monthly,
    count: byExpense.size + (monthly ? 1 : 0),
  };
}

function monthlyFlag(input: {
  month: CalendarDate;
  expenses: readonly FlagExpense[];
  settings: Pick<ClaimSettings, "cutOffDay" | "monthlyTravelLimit">;
  basis: ClaimCapBasis;
}): MonthlyFlag | null {
  const { monthlyCap } = claimCapsOn(
    input.basis,
    claimPeriod(input.month, input.settings.cutOffDay).to,
  );
  const used = sumRm(
    input.expenses
      .filter((expense) => CAPPED_EXPENSE_TYPES.includes(expense.expenseType))
      .map((expense) => expense.amount),
  );
  if (monthlyCap !== null && toCents(used) > toCents(monthlyCap)) {
    return {
      kind: "monthly_cap",
      used,
      cap: monthlyCap,
      over: sumRm([used, -monthlyCap]),
    };
  }
  const limit = input.settings.monthlyTravelLimit;
  const total = sumRm(input.expenses.map((expense) => expense.amount));
  if (limit > 0 && toCents(total) > toCents(limit)) {
    return { kind: "travel_limit", total, limit, over: sumRm([total, -limit]) };
  }
  return null;
}
