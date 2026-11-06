import { type LineUnit, lineAreaM2 } from "@/lib/domain/mof-totals";
import { roundQuantity } from "@/lib/format/quantity";

/** The supplier name a product line carries when the carpet is from Unijoy. */
export const UNIJOY = "Unijoy";

/** A product line is Unijoy's when its supplier is Unijoy, whatever the capitals or spaces. */
export const isUnijoy = (supplier: string | null | undefined): boolean =>
  (supplier ?? "").trim().toLowerCase() === UNIJOY.toLowerCase();

type Line = {
  supplier: string | null;
  qty: number;
  unit: LineUnit;
  areaM2: number;
};

/** The m² on the Unijoy lines only; other suppliers' lines are not counted. */
export function unijoyM2(lines: readonly Line[]): number {
  return roundQuantity(
    lines
      .filter((line) => isUnijoy(line.supplier))
      .reduce((total, line) => total + lineAreaM2(line), 0),
  );
}

export type UnijoyProgress = {
  m2: number;
  target: number;
  /** Whole percent of the target reached; may pass 100. */
  pct: number;
  /** m² still to go; zero once the target is reached. */
  remaining: number;
};

/** How far the year's Unijoy orders are towards its target; null when no target is set. */
export function unijoyProgress(
  m2: number,
  target: number | null,
): UnijoyProgress | null {
  if (target === null || target <= 0) return null;
  return {
    m2,
    target,
    pct: Math.round((m2 / target) * 100),
    remaining: roundQuantity(Math.max(0, target - m2)),
  };
}

/** The target for a year out of the saved setting `{ "2026": 25000 }`; null when none is set. */
export function unijoyTargetFor(setting: unknown, year: number): number | null {
  if (typeof setting !== "object" || setting === null) return null;
  const value = (setting as Record<string, unknown>)[String(year)];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
