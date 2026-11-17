import { type CalendarDate, daysBetween } from "@/lib/format/date";
import type { CustomSample, CustomSampleLoan } from "./custom-sample-types";

export type CustomSampleStatus =
  | "given"
  | "to-confirm"
  | "on-loan"
  | "available";

export const CUSTOM_SAMPLE_STATUS_LABEL: Record<CustomSampleStatus, string> = {
  given: "Given away",
  "to-confirm": "Returned – to confirm",
  "on-loan": "On loan",
  available: "Available",
};

type Lent = Pick<CustomSample, "givenOn" | "loans">;

/** The loan that has not come back yet; a sample has at most one. */
export function openLoan(sample: Lent): CustomSampleLoan | null {
  return sample.loans.find((loan) => loan.backOn === null) ?? null;
}

/** Given away beats returned-to-confirm beats on loan beats available (demo tfSt). */
export function customSampleStatus(sample: Lent): CustomSampleStatus {
  if (sample.givenOn !== null) return "given";
  const loan = openLoan(sample);
  if (!loan) return "available";
  return loan.returnedMarkedOn !== null ? "to-confirm" : "on-loan";
}

/**
 * Days past the due date of a loan the borrower has not marked returned; 0 otherwise. A marked
 * return stops counting at once, even before the office confirms it (demo tfOver).
 */
export function daysOverdue(sample: Lent, today: CalendarDate): number {
  const loan = openLoan(sample);
  if (!loan || loan.returnedMarkedOn !== null || loan.dueOn >= today) return 0;
  return daysBetween(loan.dueOn, today);
}
