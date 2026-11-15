import { describe, expect, it } from "vitest";
import { appendixStatus, ratesMatchScheme, targetOverBasic } from "./hr-scheme";

describe("ratesMatchScheme", () => {
  it("matches when the saved rates are the scheme's", () => {
    expect(ratesMatchScheme({ own: 3, pass_down: 1.5, company: 1.5 })).toEqual({
      own: true,
      shared: true,
    });
  });

  it("flags the rate that differs", () => {
    expect(ratesMatchScheme({ own: 4, pass_down: 1.5, company: 1.5 })).toEqual({
      own: false,
      shared: true,
    });
    expect(ratesMatchScheme({ own: 3, pass_down: 1.5, company: 2 })).toEqual({
      own: true,
      shared: false,
    });
  });
});

describe("targetOverBasic", () => {
  it("divides the monthly target by basic and rounds", () => {
    expect(targetOverBasic(960000, 4000)).toBe(20);
    expect(targetOverBasic(1000000, 3000)).toBe(28);
  });

  it("is empty until a basic is keyed in", () => {
    expect(targetOverBasic(960000, null)).toBeNull();
  });
});

describe("appendixStatus", () => {
  it("is not signed without a date", () => {
    expect(appendixStatus(null, null, "2026-09-08")).toBe("not_signed");
  });

  it("flags a signature on an older version of the scheme", () => {
    expect(appendixStatus("2025-01-02", "2025-01-01", "2026-09-08")).toBe(
      "older_version",
    );
  });

  it("is signed on the current version, or when no version is known to compare", () => {
    expect(appendixStatus("2026-09-10", "2026-09-08", "2026-09-08")).toBe(
      "signed",
    );
    expect(appendixStatus("2026-09-10", null, "2026-09-08")).toBe("signed");
    expect(appendixStatus("2026-09-10", "2026-09-08", null)).toBe("signed");
  });
});
