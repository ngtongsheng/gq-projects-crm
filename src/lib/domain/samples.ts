// Samples GQ keeps at Best Link (demo vSamples). Values mirror the samples migration.

/** Product groups offered for a sample (demo PRODUCTS). Free text in the database. */
export const SAMPLE_PRODUCTS = [
  "Carpet Tile",
  "Carpet Roll",
  "Vinyl Tile",
  "Vinyl Click",
  "Vinyl Sheet",
  "SPC",
  "Ready Rug",
  "Wallpaper",
  "Skirting",
  "Accessories",
  "Custom Size Rug",
  "Hand Tufted Rug",
  "Hand Tufted Carpet",
  "Axminster",
  "Printed",
  "Others",
] as const;

/** The database checks the same list. */
export const SAMPLE_UNITS = [
  "pc",
  "box",
  "set",
  "roll",
  "sheet",
  "m²",
  "catalogue",
] as const;
export type SampleUnit = (typeof SAMPLE_UNITS)[number];

export const PICKUP_METHODS = [
  "lalamove",
  "self_pickup",
  "transporter",
] as const;
export type PickupMethod = (typeof PICKUP_METHODS)[number];

export const PICKUP_METHOD_LABEL: Record<PickupMethod, string> = {
  lalamove: "Lalamove",
  self_pickup: "Self pick-up",
  transporter: "Transporter",
};

/** A Best Link pickup form has at most this many rows, as printed. */
export const PICKUP_MAX_LINES = 10;

/** adjust: quantity set to `qty`. out: taken out, may come back. kept: gone for good. */
export type SampleMove = {
  id: string;
  kind: "adjust" | "out" | "kept";
  qty: number;
  backOn: string | null;
};

export type Sample = {
  id: string;
  product: string;
  qty: number;
  unit: SampleUnit;
  moves: readonly SampleMove[];
};

/** "SR-0001". */
export const formatPickupNo = (runningNo: number) =>
  `SR-${String(runningNo).padStart(4, "0")}`;

/** "1 pc", "3 pcs", "2 boxes", "1.5 m²" (demo smpQty). */
export function formatSampleQty(qty: number, unit: SampleUnit): string {
  const amount = qty.toLocaleString("en-MY");
  if (qty <= 1 || unit === "m²") return `${amount} ${unit}`;
  return `${amount} ${unit === "box" ? "boxes" : `${unit}s`}`;
}

/** Taken out and not back yet: who has some out. */
export const movesStillOut = <Move extends SampleMove>(
  moves: readonly Move[],
): Move[] => moves.filter((move) => move.kind === "out" && !move.backOn);

/** The tiles above the list: SKUs per product, how many takings are out, and samples with none left. */
export function sampleTotals(samples: readonly Sample[]) {
  const perProduct = new Map<string, number>();
  for (const sample of samples) {
    perProduct.set(sample.product, (perProduct.get(sample.product) ?? 0) + 1);
  }
  return {
    skus: samples.length,
    perProduct: [...perProduct].sort(([a], [b]) => a.localeCompare(b)),
    takenOut: samples.reduce(
      (count, sample) => count + movesStillOut(sample.moves).length,
      0,
    ),
    noneLeft: samples.filter((sample) => !(sample.qty > 0)).length,
  };
}

export type PickupLine = { sampleId: string | null; qty: number };

/**
 * Samples a pickup form asks more of than Best Link has, with the total asked. The database
 * refuses such a form; this lets the form say so before saving. A sample on two rows counts once.
 */
export function pickupShortfalls(
  lines: readonly PickupLine[],
  atBestLink: ReadonlyMap<string, number>,
): { sampleId: string; asked: number; atBestLink: number }[] {
  const asked = new Map<string, number>();
  for (const line of lines) {
    if (line.sampleId)
      asked.set(line.sampleId, (asked.get(line.sampleId) ?? 0) + line.qty);
  }
  return [...asked]
    .map(([sampleId, total]) => ({
      sampleId,
      asked: total,
      atBestLink: atBestLink.get(sampleId) ?? 0,
    }))
    .filter((shortfall) => shortfall.asked > shortfall.atBestLink);
}
