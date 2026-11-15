const formats = new Map<number, Intl.NumberFormat>();

/** A calculator figure at a fixed number of decimals, e.g. 1,234.50 (demo: fx). */
export function formatDecimal(value: number, digits = 2): string {
  let format = formats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat("en-MY", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    formats.set(digits, format);
  }
  return format.format(value || 0);
}

/** What a person typed in a number box; blank or unreadable counts as 0, as in the demo. */
export const readNumber = (typed: string): number => Number(typed) || 0;
