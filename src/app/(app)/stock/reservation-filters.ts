import { type HoldState, isLive } from "@/lib/domain/reservation";
import { formatDate, todayMyt } from "@/lib/format/date";
import type { Reservation } from "./stock-data";

export const FILTERS = [
  { key: "active", label: "Active" },
  { key: "attention", label: "Expired / expiring" },
  { key: "all", label: "All" },
] as const;
export type Filter = (typeof FILTERS)[number]["key"];

export const parseFilter = (value: string | string[] | undefined): Filter =>
  FILTERS.find((filter) => filter.key === value)?.key ?? "active";

export type HeldReservation = { line: Reservation; hold: HoldState | null };

/** The lines the filter shows, expired holds first, then newest. */
export function selectReservations(
  lines: HeldReservation[],
  filter: Filter,
): HeldReservation[] {
  return lines
    .filter(({ line, hold }) =>
      filter === "all"
        ? true
        : filter === "active"
          ? isLive(line.status)
          : hold?.kind === "expired" || hold?.kind === "expiring",
    )
    .sort(
      (a, b) =>
        Number(b.hold?.kind === "expired") -
          Number(a.hold?.kind === "expired") ||
        b.line.createdAt.localeCompare(a.line.createdAt),
    );
}

/** Stock on hand that live holds are keeping back. */
export const heldQty = (itemId: string, lines: readonly Reservation[]) =>
  lines
    .filter((line) => line.itemId === itemId && isLive(line.status))
    .reduce((sum, line) => sum + line.qty, 0);

/** The day the hold was taken, or the day it was asked for while it waits for confirmation. */
export const reservedOnLabel = (line: Reservation) =>
  line.reservedAt
    ? formatDate(line.reservedAt)
    : `${formatDate(todayMyt(new Date(line.createdAt)))} (asked)`;
