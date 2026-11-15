import { describe, expect, it } from "vitest";
import {
  autoHotelLevel,
  claimCapFor,
  hotelBudgetFor,
  hotelLevelFor,
  mealsPerDay,
  monthlyTotal,
  nextPackageAfter,
  type OutstationRules,
  packageOn,
  type StaffPackage,
  type StandardPackages,
  standardPositionOf,
} from "./staff-package";

const row = (
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

describe("packageOn", () => {
  // Deliberately out of order: the answer must not depend on how rows are stored.
  const history = [
    row("2026-07-01", { basic: 3500 }),
    row("2025-01-01", { basic: 3000 }),
    row("2027-01-01", { basic: 4000 }),
  ];

  it("is the latest change on or before the date", () => {
    expect(packageOn(history, "2026-11-15")?.basic).toBe(3500);
    expect(packageOn(history, "2025-12-31")?.basic).toBe(3000);
  });

  it("starts on the effective date itself", () => {
    expect(packageOn(history, "2026-07-01")?.basic).toBe(3500);
    expect(packageOn(history, "2026-06-30")?.basic).toBe(3000);
  });

  it("is none before the first change or with no history", () => {
    expect(packageOn(history, "2024-12-31")).toBeNull();
    expect(packageOn([], "2026-11-15")).toBeNull();
  });
});

describe("nextPackageAfter", () => {
  const history = [row("2025-01-01"), row("2027-01-01"), row("2028-01-01")];

  it("is the soonest change still to come", () => {
    expect(nextPackageAfter(history, "2026-11-15")?.effectiveOn).toBe(
      "2027-01-01",
    );
  });

  it("is none once the last change has started", () => {
    expect(nextPackageAfter(history, "2028-01-01")).toBeNull();
  });
});

describe("monthlyTotal", () => {
  it("adds basic and allowances without float noise", () => {
    expect(
      monthlyTotal(
        row("2026-01-01", {
          basic: 3000.1,
          allowances: [{ name: "car", amount: 300.2 }],
        }),
      ),
    ).toBe(3300.3);
  });
});

describe("hotel level", () => {
  it("makes directors directors whatever their grade", () => {
    for (const jobRole of ["md", "director", "bd"] as const) {
      expect(autoHotelLevel({ jobRole, grade: "J1" })).toBe("director");
    }
  });

  it("makes grade M1 and M2 managers, everyone else staff", () => {
    expect(autoHotelLevel({ jobRole: "sales", grade: "M1" })).toBe("manager");
    expect(autoHotelLevel({ jobRole: "sales", grade: "M2" })).toBe("manager");
    expect(autoHotelLevel({ jobRole: "sales", grade: "SN3" })).toBe("staff");
    expect(autoHotelLevel({ jobRole: "site", grade: null })).toBe("staff");
  });

  it("lets the package override the automatic level", () => {
    const person = { jobRole: "sales", grade: null } as const;
    expect(hotelLevelFor(person, row("2026-01-01"))).toBe("staff");
    expect(
      hotelLevelFor(person, row("2026-01-01", { hotelLevel: "manager" })),
    ).toBe("manager");
    expect(hotelLevelFor(person, null)).toBe("staff");
  });

  it("gives each level its hotel budget and meals a full day", () => {
    const rules: OutstationRules = {
      breakfast: 10,
      lunch: 15,
      dinner: 25,
      hotel: { staff: 100, manager: 150, director: 180 },
    };
    expect(hotelBudgetFor("staff", rules)).toBe(100);
    expect(hotelBudgetFor("manager", rules)).toBe(150);
    expect(hotelBudgetFor("director", rules)).toBe(180);
    expect(mealsPerDay(rules)).toBe(50);
  });
});

describe("claim cap", () => {
  const standards: StandardPackages = {
    sales: { allowances: [], claimCap: 500 },
    site: { allowances: [], claimCap: null },
  };

  it("uses the person's own cap first", () => {
    expect(
      claimCapFor("sales", row("2026-01-01", { claimCap: 700 }), standards),
    ).toBe(700);
  });

  it("falls back to the standard for the position", () => {
    expect(claimCapFor("sales", row("2026-01-01"), standards)).toBe(500);
    expect(claimCapFor("bd", null, standards)).toBe(500);
  });

  it("is none for a position without a standard cap", () => {
    expect(claimCapFor("site", null, standards)).toBeNull();
    expect(claimCapFor("accounts", null, standards)).toBeNull();
  });

  it("keeps a zero cap of their own instead of falling back", () => {
    expect(
      claimCapFor("sales", row("2026-01-01", { claimCap: 0 }), standards),
    ).toBe(0);
  });
});

describe("standardPositionOf", () => {
  it("maps job roles to the two standard packages", () => {
    expect(standardPositionOf("sales")).toBe("sales");
    expect(standardPositionOf("bd")).toBe("sales");
    expect(standardPositionOf("site")).toBe("site");
    expect(standardPositionOf("support")).toBeNull();
  });
});
