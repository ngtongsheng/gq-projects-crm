/** A person's own targets for one year; an empty sales target falls back to the grade. */
export type YearlyTarget = {
  profileId: string;
  year: number;
  salesTarget: number | null;
  visitTarget: number | null;
};
