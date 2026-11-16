import { describe, expect, it } from "vitest";
import {
  type ClaimCapBasis,
  ClaimSettings,
  claimCapsOn,
  claimFlags,
  claimMonthOf,
  claimPeriod,
  claimTotals,
  type FlagExpense,
  mileageAmount,
} from "./monthly-claim";
import type { StaffPackage } from "./staff-package";

const pkg = (
  effectiveOn: string,
  overrides: Partial<StaffPackage> = {},
): StaffPackage => ({
  id: effectiveOn,
  profileId: "p1",
  effectiveOn,
  basic: 3000,
  allowances: [],
  claimCap: null,
  hotelLevel: null,
  reason: "",
  addedBy: "p2",
  ...overrides,
});

const basis = (overrides: Partial<ClaimCapBasis> = {}): ClaimCapBasis => ({
  person: { jobRole: "sales", grade: null },
  packages: [],
  standards: {
    sales: { allowances: [], claimCap: 500 },
    site: { allowances: [], claimCap: 500 },
  },
  outstation: {
    breakfast: 10,
    lunch: 15,
    dinner: 25,
    hotel: { staff: 100, manager: 150, director: 180 },
  },
  ...overrides,
});

const settings = { cutOffDay: 25, kmPerDay: 150, monthlyTravelLimit: 0 };

let nextId = 0;
const expense = (overrides: Partial<FlagExpense>): FlagExpense => ({
  id: `e${++nextId}`,
  spentOn: "2026-11-10",
  expenseType: "petrol",
  amount: 50,
  km: null,
  nights: null,
  ...overrides,
});

const flagsFor = (
  expenses: FlagExpense[],
  options: {
    loggedDays?: string[];
    settings?: Partial<typeof settings>;
    basis?: ClaimCapBasis;
  } = {},
) =>
  claimFlags({
    month: "2026-11-01",
    expenses,
    loggedDays: new Set(options.loggedDays ?? ["2026-11-10", "2026-11-11"]),
    settings: { ...settings, ...options.settings },
    basis: options.basis ?? basis(),
  });

describe("claimMonthOf", () => {
  it("keeps the cut-off day itself in its month", () => {
    expect(claimMonthOf("2026-11-25", 25)).toBe("2026-11-01");
    expect(claimMonthOf("2026-11-01", 25)).toBe("2026-11-01");
  });

  it("rolls the day after the cut-off into the next month", () => {
    expect(claimMonthOf("2026-11-26", 25)).toBe("2026-12-01");
    expect(claimMonthOf("2026-11-30", 25)).toBe("2026-12-01");
  });

  it("rolls late December into January of the next year", () => {
    expect(claimMonthOf("2026-12-25", 25)).toBe("2026-12-01");
    expect(claimMonthOf("2026-12-26", 25)).toBe("2027-01-01");
  });

  it("follows the cut-off day setting", () => {
    expect(claimMonthOf("2026-11-21", 20)).toBe("2026-12-01");
    expect(claimMonthOf("2026-11-28", 28)).toBe("2026-11-01");
  });
});

describe("claimPeriod", () => {
  it("runs from the day after last month's cut-off to this month's", () => {
    expect(claimPeriod("2026-11-01", 25)).toEqual({
      from: "2026-10-26",
      to: "2026-11-25",
    });
  });

  it("starts January's claim in the previous December", () => {
    expect(claimPeriod("2027-01-01", 25)).toEqual({
      from: "2026-12-26",
      to: "2027-01-25",
    });
  });

  it("starts March's claim inside February", () => {
    expect(claimPeriod("2027-03-01", 28)).toEqual({
      from: "2027-03-01",
      to: "2027-03-28",
    });
  });
});

describe("mileageAmount", () => {
  it("is km times the rate", () => {
    expect(mileageAmount(120, 0.6)).toBe(72);
  });

  it("rounds to the sen, half up", () => {
    expect(mileageAmount(33.3, 0.6)).toBe(19.98);
    expect(mileageAmount(10.1, 0.65)).toBe(6.57);
    expect(mileageAmount(0.1, 0.05)).toBe(0.01);
  });
});

describe("claimTotals", () => {
  const totals = claimTotals({
    commissions: [
      { originalAmount: 1000.1, amount: 1000.1 },
      { originalAmount: 500, amount: 400 },
    ],
    expenses: [
      { originalAmount: 0.1, amount: 0.1 },
      { originalAmount: 0.2, amount: 0.2 },
    ],
    ot: { originalAmount: 120, amount: 100 },
  });

  it("adds each section on the sen", () => {
    expect(totals.commission).toEqual({ original: 1500.1, final: 1400.1 });
    expect(totals.expenses).toEqual({ original: 0.3, final: 0.3 });
    expect(totals.ot).toEqual({ original: 120, final: 100 });
  });

  it("shows the original claim against the final approved amount", () => {
    expect(totals.original).toBe(1620.4);
    expect(totals.final).toBe(1500.4);
    expect(totals.difference).toBe(-120);
  });

  it("has no difference when nothing was adjusted", () => {
    expect(
      claimTotals({
        commissions: [],
        expenses: [{ originalAmount: 30, amount: 30 }],
        ot: { originalAmount: 0, amount: 0 },
      }).difference,
    ).toBe(0);
  });
});

describe("claimCapsOn", () => {
  it("uses the package in force on the date", () => {
    const packages = [
      pkg("2026-01-01", { claimCap: 600 }),
      pkg("2026-12-01", { claimCap: 700, hotelLevel: "manager" }),
    ];
    expect(claimCapsOn(basis({ packages }), "2026-11-25")).toEqual({
      monthlyCap: 600,
      hotelBudget: 100,
    });
    expect(claimCapsOn(basis({ packages }), "2026-12-01")).toEqual({
      monthlyCap: 700,
      hotelBudget: 150,
    });
  });

  it("falls back to the position's standard cap", () => {
    expect(claimCapsOn(basis(), "2026-11-25").monthlyCap).toBe(500);
  });

  it("treats no cap and a cap of 0 as none", () => {
    const office = basis({ person: { jobRole: "accounts", grade: null } });
    expect(claimCapsOn(office, "2026-11-25").monthlyCap).toBeNull();
    const zero = basis({ packages: [pkg("2026-01-01", { claimCap: 0 })] });
    expect(claimCapsOn(zero, "2026-11-25").monthlyCap).toBeNull();
  });
});

describe("claimFlags", () => {
  it("raises nothing on a clean claim", () => {
    const result = flagsFor([expense({ amount: 100 })]);
    expect(result.byExpense.size).toBe(0);
    expect(result.monthly).toBeNull();
    expect(result.count).toBe(0);
  });

  it("flags a line on a day with no visit or site work logged", () => {
    const line = expense({ spentOn: "2026-11-12" });
    expect(flagsFor([line]).byExpense.get(line.id)).toEqual([
      { kind: "no_visit" },
    ]);
  });

  it("flags a hotel night over the person's budget, per night", () => {
    const over = expense({ expenseType: "hotel", amount: 201, nights: 2 });
    const within = expense({ expenseType: "hotel", amount: 200, nights: 2 });
    const result = flagsFor([over, within]);
    expect(result.byExpense.get(over.id)).toEqual([
      { kind: "hotel_over_budget", perNight: 100.5, budget: 100 },
    ]);
    expect(result.byExpense.has(within.id)).toBe(false);
  });

  it("holds the hotel against the level on the package then", () => {
    const director = basis({
      packages: [pkg("2026-01-01", { hotelLevel: "director" })],
    });
    const line = expense({ expenseType: "hotel", amount: 170, nights: 1 });
    expect(flagsFor([line], { basis: director }).byExpense.size).toBe(0);
  });

  it("flags outstation meals claimed twice on one day", () => {
    const first = expense({ expenseType: "outstation_meals" });
    const second = expense({ expenseType: "outstation_meals" });
    const otherDay = expense({
      expenseType: "outstation_meals",
      spentOn: "2026-11-11",
    });
    const result = flagsFor([first, second, otherDay]);
    expect(result.byExpense.get(first.id)).toEqual([{ kind: "meals_twice" }]);
    expect(result.byExpense.get(second.id)).toEqual([{ kind: "meals_twice" }]);
    expect(result.byExpense.has(otherDay.id)).toBe(false);
  });

  it("flags mileage over the km a day, summed across the day", () => {
    const morning = expense({
      expenseType: "mileage",
      km: 80.1,
      amount: 48.06,
    });
    const evening = expense({ expenseType: "mileage", km: 70, amount: 42 });
    const result = flagsFor([morning, evening]);
    const flag = { kind: "km_over_day", km: 150.1, kmPerDay: 150 };
    expect(result.byExpense.get(morning.id)).toEqual([flag]);
    expect(result.byExpense.get(evening.id)).toEqual([flag]);
  });

  it("allows exactly the km a day", () => {
    const line = expense({ expenseType: "mileage", km: 150, amount: 90 });
    expect(flagsFor([line]).byExpense.size).toBe(0);
  });

  it("flags petrol, toll and parking over the monthly cap", () => {
    const result = flagsFor([
      expense({ expenseType: "petrol", amount: 300 }),
      expense({ expenseType: "toll", amount: 150 }),
      expense({ expenseType: "parking", amount: 50.01 }),
      // Not under the cap.
      expense({ expenseType: "grab", amount: 400 }),
      expense({ expenseType: "mileage", km: 100, amount: 60 }),
    ]);
    expect(result.monthly).toEqual({
      kind: "monthly_cap",
      used: 500.01,
      cap: 500,
      over: 0.01,
    });
    expect(result.count).toBe(1);
  });

  it("allows exactly the monthly cap", () => {
    const result = flagsFor([expense({ expenseType: "petrol", amount: 500 })]);
    expect(result.monthly).toBeNull();
  });

  it("takes the cap from the package on the claim's cut-off date", () => {
    const packages = [
      pkg("2026-01-01", { claimCap: 300 }),
      pkg("2026-11-26", { claimCap: 1000 }),
    ];
    const result = flagsFor([expense({ amount: 400 })], {
      basis: basis({ packages }),
    });
    expect(result.monthly).toMatchObject({ kind: "monthly_cap", cap: 300 });
  });

  it("falls back to the monthly travel limit when the cap is not over", () => {
    const office = basis({ person: { jobRole: "accounts", grade: null } });
    const lines = [
      expense({ expenseType: "grab", amount: 600 }),
      expense({ expenseType: "petrol", amount: 100 }),
    ];
    expect(
      flagsFor(lines, { basis: office, settings: { monthlyTravelLimit: 650 } })
        .monthly,
    ).toEqual({ kind: "travel_limit", total: 700, limit: 650, over: 50 });
    expect(flagsFor(lines, { basis: office }).monthly).toBeNull();
  });

  it("counts flagged lines plus the monthly flag", () => {
    const result = flagsFor([
      expense({ spentOn: "2026-11-12", amount: 300 }),
      expense({ spentOn: "2026-11-13", amount: 300 }),
    ]);
    expect(result.count).toBe(3);
  });
});

describe("ClaimSettings", () => {
  const valid = {
    cutOffDay: 25,
    mileageRatePerKm: 0.6,
    kmPerDay: 150,
    monthlyTravelLimit: 0,
    needReport: true,
  };

  it("accepts the defaults", () => {
    expect(ClaimSettings.safeParse(valid).success).toBe(true);
  });

  it("keeps the cut-off day a whole day from 1 to 28", () => {
    expect(ClaimSettings.safeParse({ ...valid, cutOffDay: 29 }).success).toBe(
      false,
    );
    expect(ClaimSettings.safeParse({ ...valid, cutOffDay: 2.5 }).success).toBe(
      false,
    );
  });
});
