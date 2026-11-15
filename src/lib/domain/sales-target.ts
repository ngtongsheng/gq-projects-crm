// Mirrors effective_sales_target() in the yearly_targets migration (loop 16 D3).

/** A person's own targets for one year; an empty sales target falls back to the grade. */
export type YearlyTarget = {
  profileId: string;
  year: number;
  salesTarget: number | null;
  visitTarget: number | null;
};

export type SalesTargetSource = "own" | "grade" | "none";

export type EffectiveSalesTarget = {
  amount: number | null;
  source: SalesTargetSource;
};

/** The person's own sales target for the year, else their grade's annual target. */
export function effectiveSalesTarget(
  own: Pick<YearlyTarget, "salesTarget"> | undefined,
  gradeAnnualTarget: number | null,
): EffectiveSalesTarget {
  if (own?.salesTarget != null) {
    return { amount: own.salesTarget, source: "own" };
  }
  if (gradeAnnualTarget !== null) {
    return { amount: gradeAnnualTarget, source: "grade" };
  }
  return { amount: null, source: "none" };
}
