// Areas and stock quantities are stored to 2 decimals (Postgres numeric). toPrecision(15) drops
// binary noise first, so 2.135 rounds to 2.14 like the database would, not 2.13.
export function roundQuantity(value: number): number {
  return Math.round(Number((value * 100).toPrecision(15))) / 100;
}
