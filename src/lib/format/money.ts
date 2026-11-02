const rmFormat = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// toPrecision(15) drops binary noise so 1.005 rounds to 1.01 like a person would expect.
export function toCents(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15)));
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatRm(amount: number): string {
  const sign = toCents(amount) < 0 ? "-" : "";
  return `${sign}RM ${rmFormat.format(Math.abs(fromCents(toCents(amount))))}`;
}

// Form input such as "RM 1,234.5" or "1234". Returns null for anything that is not an amount.
export function parseRm(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/^RM\s*/i, "")
    .replace(/,/g, "");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  return fromCents(toCents(Number(cleaned)));
}

// Adds on cents so 0.1 + 0.2 stays 0.30.
export function sumRm(amounts: readonly number[]): number {
  return fromCents(
    amounts.reduce((total, amount) => total + toCents(amount), 0),
  );
}
