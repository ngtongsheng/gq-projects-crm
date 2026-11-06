import { describe, expect, it, vi } from "vitest";
import {
  inYear,
  parseSummaryYear,
  type SummaryRow,
  summaryYears,
} from "./summary-data";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const row = (loaDate: string) => ({ loaDate }) as SummaryRow;
const rows = [row("2027-01-04"), row("2026-11-02"), row("2026-02-10")];

describe("summary years", () => {
  it("lists the years there are MOFs in, newest first, with this year always there", () => {
    expect(summaryYears(rows, 2026)).toEqual([2027, 2026]);
    expect(summaryYears([], 2026)).toEqual([2026]);
  });

  it("takes the year asked for, all years, or falls back to this year", () => {
    const years = [2027, 2026];
    expect(parseSummaryYear("2027", years, 2026)).toBe(2027);
    expect(parseSummaryYear("all", years, 2026)).toBeNull();
    expect(parseSummaryYear("1999", years, 2026)).toBe(2026);
    expect(parseSummaryYear("abc", years, 2026)).toBe(2026);
    expect(parseSummaryYear(undefined, years, 2026)).toBe(2026);
  });

  it("keeps only the MOFs of the year, or all of them", () => {
    expect(inYear(rows, 2026)).toHaveLength(2);
    expect(inYear(rows, 2027)).toHaveLength(1);
    expect(inYear(rows, null)).toHaveLength(3);
  });
});
