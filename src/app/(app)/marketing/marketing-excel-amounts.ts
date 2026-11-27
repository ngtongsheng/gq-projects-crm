import { parseRm } from "@/lib/format/money";

// A cell like "RM 12.50" or "1,200" as a number; null when it is not an amount.
const amountOf = (text: string) => (text === "" ? null : parseRm(text));

// Money worked out from a total and a count, for files that only have the total.
export const dividedText = (totalText: string, count: string) => {
  const total = amountOf(totalText);
  const divisor = count === "" ? 1 : parseRm(count);
  if (total === null || divisor === null || divisor <= 0) return "";
  return String(total / divisor);
};
