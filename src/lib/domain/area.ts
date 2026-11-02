const SQFT_PER_M2 = 10.764;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sqftToM2(sqft: number): number {
  return round2(sqft / SQFT_PER_M2);
}

export function m2ToSqft(m2: number): number {
  return round2(m2 * SQFT_PER_M2);
}
