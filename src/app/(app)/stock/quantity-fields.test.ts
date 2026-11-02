import { describe, expect, it } from "vitest";
import { onHandQuantity, positiveQuantity } from "./quantity-fields";

describe("positiveQuantity", () => {
  it("rounds to the 2 decimals the database keeps", () => {
    expect(positiveQuantity.parse("2.135")).toBe(2.14);
  });

  it("refuses an amount that would be saved as zero", () => {
    const result = positiveQuantity.safeParse("0.004");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Enter a quantity above zero.",
    );
  });

  it("refuses blank and non-numbers", () => {
    expect(positiveQuantity.safeParse("abc").success).toBe(false);
  });
});

describe("onHandQuantity", () => {
  it("allows zero and refuses negatives", () => {
    expect(onHandQuantity.parse("0")).toBe(0);
    expect(onHandQuantity.safeParse("-1").success).toBe(false);
  });

  it("does not read a blank as zero", () => {
    expect(onHandQuantity.safeParse("").success).toBe(false);
    expect(onHandQuantity.safeParse("  ").success).toBe(false);
  });
});
