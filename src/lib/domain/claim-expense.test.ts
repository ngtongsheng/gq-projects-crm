import { describe, expect, it } from "vitest";
import {
  describeMeals,
  ExpenseInput,
  mealsAmount,
  needsReceipt,
} from "./claim-expense";

const RULES = { breakfast: 10, lunch: 20, dinner: 25 };

const line = (over: Record<string, unknown>) => ({
  spentOn: "2026-11-10",
  expenseType: "petrol",
  description: "Office to site",
  amount: 45.5,
  km: null,
  nights: null,
  ...over,
});

describe("mealsAmount", () => {
  it("adds the allowance of each ticked meal", () => {
    expect(mealsAmount(RULES, ["breakfast", "dinner"])).toBe(35);
    expect(mealsAmount(RULES, [])).toBe(0);
  });
});

describe("describeMeals", () => {
  it("names the ticked meals so the checker can read them", () => {
    expect(describeMeals("KL to Penang", ["lunch", "dinner"])).toBe(
      "KL to Penang (Lunch, Dinner)",
    );
    expect(describeMeals("KL to Penang", [])).toBe("KL to Penang");
  });
});

describe("needsReceipt", () => {
  it("is false for meals and mileage only", () => {
    expect(needsReceipt("outstation_meals")).toBe(false);
    expect(needsReceipt("mileage")).toBe(false);
    expect(needsReceipt("petrol")).toBe(true);
    expect(needsReceipt("hotel")).toBe(true);
  });
});

describe("ExpenseInput", () => {
  it("accepts a plain expense and rounds the amount to the sen", () => {
    const parsed = ExpenseInput.parse(line({ amount: 12.345 }));
    expect(parsed.amount).toBe(12.35);
    expect(parsed.km).toBeNull();
    expect(parsed.nights).toBeNull();
  });

  it("needs an amount above zero", () => {
    for (const amount of [null, 0, -3]) {
      const result = ExpenseInput.safeParse(line({ amount }));
      expect(result.error?.issues[0]?.message).toBe("Key in the amount.");
    }
  });

  it("refuses an absurd amount", () => {
    expect(ExpenseInput.safeParse(line({ amount: 1_000_000 })).success).toBe(
      false,
    );
  });

  it("needs a hotel's nights as a whole number from 1", () => {
    const hotel = { expenseType: "hotel", amount: 300 };
    expect(ExpenseInput.parse(line({ ...hotel, nights: 2 })).nights).toBe(2);
    for (const nights of [null, 0, 1.5, 61]) {
      expect(ExpenseInput.safeParse(line({ ...hotel, nights })).success).toBe(
        false,
      );
    }
  });

  it("drops the nights and km of a type that has none", () => {
    const parsed = ExpenseInput.parse(line({ km: 20, nights: 2 }));
    expect(parsed.km).toBeNull();
    expect(parsed.nights).toBeNull();
  });

  it("takes mileage as km and leaves the amount to the database", () => {
    const parsed = ExpenseInput.parse(
      line({ expenseType: "mileage", amount: 99, km: 42.34 }),
    );
    expect(parsed.km).toBe(42.3);
    expect(parsed.amount).toBeNull();
    expect(
      ExpenseInput.safeParse(
        line({ expenseType: "mileage", amount: null, km: null }),
      ).success,
    ).toBe(false);
  });

  it("needs where or what", () => {
    const result = ExpenseInput.safeParse(line({ description: "  " }));
    expect(result.error?.issues[0]?.message).toBe("Write where or what.");
  });
});
