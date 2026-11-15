import { describe, expect, it } from "vitest";
import { ratesMatchScheme, targetOverBasic } from "./hr-scheme";

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
