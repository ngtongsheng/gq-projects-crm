import type { StatusTone } from "@/components/app/status-badge";
import { canEditStock, type JobRole } from "@/lib/auth/job-role";
import { formatRm } from "@/lib/format/money";

// Values mirror the check constraints in the leftovers migration.
export const LEFTOVER_UNITS = [
  "box",
  "m2",
  "roll",
  "pcs",
  "pail",
  "bag",
] as const;
export type LeftoverUnit = (typeof LEFTOVER_UNITS)[number];

export const LEFTOVER_UNIT_LABEL: Record<LeftoverUnit, string> = {
  box: "box",
  m2: "m²",
  roll: "roll",
  pcs: "pcs",
  pail: "pail",
  bag: "bag",
};

export const LEFTOVER_CONDITIONS = ["good", "offcut", "damaged"] as const;
export type LeftoverCondition = (typeof LEFTOVER_CONDITIONS)[number];

export const LEFTOVER_CONDITION_LABEL: Record<LeftoverCondition, string> = {
  good: "Good",
  offcut: "Cut pieces / offcut",
  damaged: "Damaged",
};

export const LEFTOVER_DESTINATIONS = ["supplier", "gq"] as const;
export type LeftoverDestination = (typeof LEFTOVER_DESTINATIONS)[number];

export const LEFTOVER_DESTINATION_LABEL: Record<LeftoverDestination, string> = {
  supplier: "Return to supplier (get credit note)",
  gq: "GQ keeps at Best Link (cannot return)",
};

export const LEFTOVER_STATUSES = [
  "pending_pickup",
  "returned_to_supplier",
  "at_best_link",
  "left_with_client",
  "disposed",
] as const;
export type LeftoverStatus = (typeof LEFTOVER_STATUSES)[number];

export const LEFTOVER_STATUS_LABEL: Record<LeftoverStatus, string> = {
  pending_pickup: "Pending pickup",
  returned_to_supplier: "Returned to supplier",
  at_best_link: "At Best Link (for resale)",
  left_with_client: "Left with client",
  disposed: "Disposed",
};

export const LEFTOVER_STATUS_TONE: Record<LeftoverStatus, StatusTone> = {
  pending_pickup: "warn",
  returned_to_supplier: "good",
  at_best_link: "good",
  left_with_client: "neutral",
  disposed: "neutral",
};

/**
 * Who may record leftover stock (SQL: the insert policy on leftovers). Site supervisors
 * record it from the site; the people who arrange stock can too.
 */
export const canRecordLeftover = (person: {
  jobRole: JobRole;
  arrangesStock: boolean;
}) => person.jobRole === "site" || canEditStock(person);

/** Custom, rolled, cut or indent items are stock GQ cannot send back; the rest goes to the supplier. */
export function suggestLeftoverDestination(
  item: string,
  unit: LeftoverUnit,
): LeftoverDestination {
  return /roll|custom|cut|offcut|china|indent/i.test(`${item} ${unit}`)
    ? "gq"
    : "supplier";
}

export type LeftoverFacts = {
  destination: LeftoverDestination;
  status: LeftoverStatus;
  creditNoteNo: string | null;
  creditNoteAmount: number | null;
};

/**
 * Why these facts cannot be saved, or null when they can (SQL: the check constraints on
 * leftovers). The credit note number is not required to mark an item returned: the supplier
 * often sends it later, and the item shows "Credit note pending" until it is keyed in.
 */
export function leftoverProblem(facts: LeftoverFacts): string | null {
  if (
    facts.status === "returned_to_supplier" &&
    facts.destination !== "supplier"
  ) {
    return "This item is set to stay with GQ, so it cannot be marked returned to the supplier.";
  }
  if (facts.status === "at_best_link" && facts.destination !== "gq") {
    return "This item is set to go back to the supplier, so it cannot be marked at Best Link.";
  }
  const hasCreditNote =
    facts.creditNoteNo !== null || facts.creditNoteAmount !== null;
  if (hasCreditNote && facts.destination !== "supplier") {
    return "A credit note only applies to stock returned to the supplier.";
  }
  if (facts.creditNoteAmount !== null && facts.creditNoteNo === null) {
    return "Enter the credit note number with its amount.";
  }
  return null;
}

export type CreditNoteState =
  | { kind: "received"; label: string }
  | { kind: "pending" };

/** Credit note shown for a supplier return: received once keyed in, pending once the item is back. */
export function creditNoteState(facts: LeftoverFacts): CreditNoteState | null {
  if (facts.destination !== "supplier") return null;
  if (facts.creditNoteNo !== null) {
    const amount =
      facts.creditNoteAmount !== null
        ? ` · ${formatRm(facts.creditNoteAmount)}`
        : "";
    return { kind: "received", label: `CN ${facts.creditNoteNo}${amount}` };
  }
  return facts.status === "returned_to_supplier" ? { kind: "pending" } : null;
}
