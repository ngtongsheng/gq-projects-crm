import { roundQuantity } from "@/lib/format/quantity";

const SQFT_PER_M2 = 10.764;

export function sqftToM2(sqft: number): number {
  return roundQuantity(sqft / SQFT_PER_M2);
}

export function m2ToSqft(m2: number): number {
  return roundQuantity(m2 * SQFT_PER_M2);
}
