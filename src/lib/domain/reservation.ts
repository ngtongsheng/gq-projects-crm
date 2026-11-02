import type { StatusTone } from "@/components/app/status-badge";
import {
  addDays,
  type CalendarDate,
  daysBetween,
  formatDate,
} from "@/lib/format/date";

// Values mirror the check constraints in the stock migration.
export const STOCK_UNITS = [
  "box",
  "sqft",
  "m2",
  "roll",
  "pcs",
  "slab",
  "pail",
  "bag",
] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

export const STOCK_UNIT_LABEL: Record<StockUnit, string> = {
  box: "box",
  sqft: "sq ft",
  m2: "m²",
  roll: "roll",
  pcs: "pcs",
  slab: "slab",
  pail: "pail",
  bag: "bag",
};

export const RESERVATION_STATUSES = [
  "requested",
  "reserved",
  "po_issued",
  "delivered",
  "released",
  "cancelled",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  requested: "Requested",
  reserved: "Reserved",
  po_issued: "PO issued",
  delivered: "Delivered",
  released: "Released",
  cancelled: "Cancelled",
};

export const RESERVATION_STATUS_TONE: Record<ReservationStatus, StatusTone> = {
  requested: "neutral",
  reserved: "info",
  po_issued: "warn",
  delivered: "good",
  released: "neutral",
  cancelled: "neutral",
};

/** Stock these statuses hold back from the shelf. */
const LIVE: readonly ReservationStatus[] = [
  "requested",
  "reserved",
  "po_issued",
];
/** Confirmed holds, which run out on a date. */
const HELD: readonly ReservationStatus[] = ["reserved", "po_issued"];

export const isLive = (status: ReservationStatus) => LIVE.includes(status);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * What can still be promised: the stock on hand less live holds (an expired hold stays live
 * until released) and delivered lines, which are sold. Never below zero.
 */
export function availableQty(
  qty: number,
  reservations: readonly { status: ReservationStatus; qty: number }[],
): number {
  const taken = reservations
    .filter((line) => isLive(line.status) || line.status === "delivered")
    .reduce((sum, line) => sum + line.qty, 0);
  return Math.max(0, round2(qty - taken));
}

export type HoldState =
  | { kind: "waiting" }
  | { kind: "expiring"; daysLeft: number }
  | { kind: "expired"; daysAgo: number };

/**
 * Whether a hold needs attention today, or null. Expiry is worked out here on read; nothing
 * flips the status at midnight. A hold ending within `warningDays` (inclusive) is expiring;
 * one ending today is the last day.
 */
export function holdState(
  line: { status: ReservationStatus; expiresOn: CalendarDate | null },
  today: CalendarDate,
  warningDays: number,
): HoldState | null {
  if (line.status === "requested") return { kind: "waiting" };
  if (!HELD.includes(line.status) || !line.expiresOn) return null;
  const daysLeft = daysBetween(today, line.expiresOn);
  if (daysLeft < 0) return { kind: "expired", daysAgo: -daysLeft };
  if (daysLeft <= warningDays) return { kind: "expiring", daysLeft };
  return null;
}

/** What to do about a hold, in words. */
export function holdLabel(hold: HoldState): string {
  switch (hold.kind) {
    case "waiting":
      return "Waiting for confirmation";
    case "expiring":
      return hold.daysLeft === 0
        ? "Last day today"
        : `Expiring in ${hold.daysLeft}d`;
    case "expired":
      return `Expired ${hold.daysAgo}d, extend or release`;
  }
}

/** Last day of a hold taken on `from`. */
export const holdUntil = (from: CalendarDate, holdDays: number) =>
  addDays(from, holdDays);

/** Extending adds the hold days to whichever is later, the current end or today, so a lapsed hold restarts. */
export function extendedUntil(
  expiresOn: CalendarDate,
  today: CalendarDate,
  holdDays: number,
): CalendarDate {
  return addDays(expiresOn > today ? expiresOn : today, holdDays);
}

const MOVES: Record<ReservationStatus, readonly ReservationStatus[]> = {
  requested: ["reserved", "cancelled"],
  reserved: ["po_issued", "delivered", "released"],
  po_issued: ["delivered", "released"],
  delivered: [],
  released: [],
  cancelled: [],
};

export const canMoveReservation = (
  from: ReservationStatus,
  to: ReservationStatus,
) => MOVES[from].includes(to);

export const reservationMoves = (from: ReservationStatus) => MOVES[from];

export const canExtendHold = (status: ReservationStatus) =>
  HELD.includes(status);

/**
 * A prefilled email to the supplier to hold, extend or let go of a line. The supplier's address
 * is not stored, so it opens with the To field empty. Null for lines that need no email.
 */
export function supplierMailto(line: {
  status: ReservationStatus;
  sku: string;
  collection: string;
  qty: number;
  unit: StockUnit;
  projectName: string;
  expiresOn: CalendarDate | null;
}): string | null {
  const what = `${line.qty.toLocaleString("en-MY")} ${STOCK_UNIT_LABEL[line.unit]} of ${line.sku}${line.collection ? ` (${line.collection})` : ""}`;
  let subject: string;
  let body: string;
  if (HELD.includes(line.status) && line.expiresOn) {
    subject = `Please hold ${line.sku}`;
    body = `Hi,\n\nPlease hold ${what} for ${line.projectName} until ${formatDate(line.expiresOn)}.\n\nThank you.`;
  } else if (line.status === "released") {
    subject = `Release ${line.sku}`;
    body = `Hi,\n\nPlease release the hold on ${what} for ${line.projectName}.\n\nThank you.`;
  } else {
    return null;
  }
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
