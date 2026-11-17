import type { CalendarDate } from "@/lib/format/date";

/** One loan of a custom sample to a salesperson (table custom_sample_loans). */
export type CustomSampleLoan = {
  id: string;
  salespersonId: string;
  customer: string;
  project: string | null;
  outOn: CalendarDate;
  dueOn: CalendarDate;
  /** The borrower's "I've returned it"; the office has not confirmed yet. */
  returnedMarkedOn: CalendarDate | null;
  backOn: CalendarDate | null;
  givenAway: boolean;
};

/** A hand-tufted sample with its loans, oldest first (table custom_samples). */
export type CustomSample = {
  id: string;
  code: string;
  receivedOn: CalendarDate;
  designName: string;
  designNo: string;
  supplier: string | null;
  size: string | null;
  qty: number;
  photoPath: string | null;
  /** A short-lived link to the photo; null when it has none or links cannot be made here. */
  photoUrl: string | null;
  notes: string | null;
  recordedBy: string;
  givenOn: CalendarDate | null;
  givenTo: string | null;
  giftReason: string | null;
  givenBy: string | null;
  loans: CustomSampleLoan[];
};
