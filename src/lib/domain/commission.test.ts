import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/format/date";
import {
  type CommissionInput,
  calculateCommission,
  estimatedCommission,
} from "./commission";
import { DEFAULT_COMMISSION_SETTINGS } from "./commission-settings";

const INVOICED = "2027-01-01";
const SALES = { id: "sales", name: "Sarah", commissionMode: "standard" };
const SECOND = { id: "second", name: "Ken", commissionMode: "standard" };
const EXCLUDED = { id: "md", name: "Eddie", commissionMode: "excluded" };
const FLAT = { id: "bd", name: "Vanessa", commissionMode: "flat_pass_down" };

/** RM 100,000 own-effort MOF, cost 65,000 (35% margin), paid in full on the invoice date. */
function input(overrides: Partial<CommissionInput> = {}): CommissionInput {
  return {
    mof: {
      total: 100_000,
      commissionType: "own",
      invoiceDate: INVOICED,
      loaDate: "2026-12-01",
      salespersonId: SALES.id,
      secondSalespersonId: null,
      passedById: null,
    },
    cost: 65_000,
    payments: [{ amount: 100_000, receivedOn: INVOICED }],
    people: [SALES, SECOND, EXCLUDED, FLAT] as CommissionInput["people"],
    settings: DEFAULT_COMMISSION_SETTINGS,
    today: "2027-02-01",
    ...overrides,
  };
}

const withMof = (mof: Partial<CommissionInput["mof"]>) =>
  input({ mof: { ...input().mof, ...mof } });
const withCost = (cost: number | null) => input({ cost });
const only = (overrides: Partial<CommissionInput>) => {
  const result = calculateCommission(input(overrides));
  expect(result.people).toHaveLength(1);
  return result.people[0];
};

describe("calculateCommission: margin tiers", () => {
  it.each([
    [80_001, "none", 0], // 19.999% margin
    [80_000, "low", 1_500], // exactly 20%: low, own rate capped at 1.5%
    [70_001, "low", 1_500], // 29.999%
    [70_000, "standard", 3_000], // exactly 30%
    [55_000, "standard", 3_000], // exactly 45%: not above
    [54_999, "high", 4_000], // 45.001%: +1%
  ] as const)("cost %d is tier %s, earning %d", (cost, tier, earned) => {
    const result = calculateCommission(withCost(cost));
    expect(result.tier).toBe(tier);
    expect(result.people[0]?.earned).toBe(earned);
  });

  it("caps pass-down and company at the lower low-margin rate", () => {
    const result = calculateCommission(
      input({
        cost: 75_000,
        mof: { ...input().mof, commissionType: "company" },
      }),
    );
    expect(result.people[0]).toMatchObject({ ratePct: 1, earned: 1_000 });
  });

  it("uses the MD's tiers from settings", () => {
    const settings = { ...DEFAULT_COMMISSION_SETTINGS, highMarginAbovePct: 30 };
    expect(only({ settings, cost: 65_000 }).ratePct).toBe(4);
  });
});

describe("calculateCommission: late collection", () => {
  it.each([
    [90, 0],
    [91, 25],
    [120, 25],
    [121, 50],
  ])("money received %d days after the invoice is cut %d%%", (days, cut) => {
    const person = only({
      payments: [{ amount: 100_000, receivedOn: addDays(INVOICED, days) }],
    });
    expect(person.lateCut).toBe((3_000 * cut) / 100);
    expect(person.earned).toBe(3_000 - (3_000 * cut) / 100);
    expect(person.full).toBe(3_000);
  });

  it("cuts only the late payments", () => {
    const person = only({
      payments: [
        { amount: 50_000, receivedOn: addDays(INVOICED, 30) },
        { amount: 50_000, receivedOn: addDays(INVOICED, 100) },
      ],
    });
    expect(person).toMatchObject({ earned: 2_625, lateCut: 375 });
    expect(person.lines.some((line) => line.includes("cut 25%"))).toBe(true);
  });

  it("counts from the LOA date until there is an invoice date", () => {
    const person = calculateCommission({
      ...withMof({ invoiceDate: null }),
      payments: [{ amount: 100_000, receivedOn: "2027-03-02" }],
    }).people[0];
    expect(person?.lateCut).toBe(750); // 91 days after 2026-12-01
  });

  it("pays nothing on money beyond the order total", () => {
    const person = only({
      payments: [
        { amount: 100_000, receivedOn: INVOICED },
        { amount: 5_000, receivedOn: addDays(INVOICED, 200) },
      ],
    });
    expect(person).toMatchObject({ earned: 3_000, lateCut: 0 });
  });
});

describe("calculateCommission: people", () => {
  it("splits half and half between two salespeople", () => {
    const result = calculateCommission(
      withMof({ secondSalespersonId: SECOND.id }),
    );
    expect(result.people.map((p) => [p.name, p.sharePct, p.earned])).toEqual([
      ["Sarah", 50, 1_500],
      ["Ken", 50, 1_500],
    ]);
  });

  it("follows the MD's split share", () => {
    const settings = { ...DEFAULT_COMMISSION_SETTINGS, splitSharePct: 60 };
    const result = calculateCommission({
      ...withMof({ secondSalespersonId: SECOND.id }),
      settings,
    });
    expect(result.people.map((p) => p.earned)).toEqual([1_800, 1_200]);
  });

  it("gives an excluded person nothing and keeps the other half split", () => {
    const result = calculateCommission(
      withMof({ salespersonId: EXCLUDED.id, secondSalespersonId: SECOND.id }),
    );
    expect(result.people.map((p) => [p.name, p.earned])).toEqual([
      ["Ken", 1_500],
    ]);
    expect(result.lines).toContain("Eddie has no commission (person setting).");
  });

  it("pays the flat pass-down person 1% on their own sale, whatever the type", () => {
    const person = calculateCommission(withMof({ salespersonId: FLAT.id }))
      .people[0];
    expect(person).toMatchObject({
      name: "Vanessa",
      ratePct: 1,
      earned: 1_000,
    });
  });

  it("pays the flat pass-down person 1% on the whole sale they passed down", () => {
    const result = calculateCommission(
      withMof({
        commissionType: "pass_down",
        passedById: FLAT.id,
        secondSalespersonId: SECOND.id,
      }),
    );
    expect(result.people.map((p) => [p.name, p.ratePct, p.earned])).toEqual([
      ["Sarah", 1.5, 750],
      ["Ken", 1.5, 750],
      ["Vanessa", 1, 1_000],
    ]);
  });

  it("gives a standard person who passed a sale down nothing extra", () => {
    const result = calculateCommission(
      withMof({ commissionType: "pass_down", passedById: SECOND.id }),
    );
    expect(result.people.map((p) => p.name)).toEqual(["Sarah"]);
  });

  it("gives the flat person no high-margin extra and no low-margin cut", () => {
    const flat = (cost: number) =>
      calculateCommission({
        ...withMof({ salespersonId: FLAT.id }),
        cost,
      }).people[0]?.ratePct;
    expect(flat(50_000)).toBe(1);
    expect(flat(75_000)).toBe(1);
    expect(flat(85_000)).toBe(0);
  });
});

describe("calculateCommission: claimable", () => {
  it("is not claimable under 90% paid", () => {
    const result = calculateCommission(
      input({ payments: [{ amount: 89_999.99, receivedOn: INVOICED }] }),
    );
    expect(result.claimable).toBe(false);
    expect(result.people[0]).toMatchObject({ claimable: false, earned: 2_700 });
    expect(result.lines).toContain("89.9% paid: claimable from 90%.");
  });

  it("is claimable from 90% paid", () => {
    const result = calculateCommission(
      input({ payments: [{ amount: 90_000, receivedOn: INVOICED }] }),
    );
    expect(result.claimable).toBe(true);
    expect(result.people[0]?.earned).toBe(2_700);
  });

  it("is not claimable when the margin rule leaves nothing", () => {
    expect(calculateCommission(withCost(85_000)).claimable).toBe(false);
  });

  it("estimates at the base rate but holds the claim when the cost is missing", () => {
    const result = calculateCommission(withCost(null));
    expect(result).toMatchObject({
      tier: "unknown",
      marginPct: null,
      claimable: false,
    });
    expect(result.people[0]?.earned).toBe(3_000);
    expect(result.lines[0]).toMatch(/Cost not keyed in/);
  });

  it("warns how long until the first late cut while money is owed", () => {
    const result = calculateCommission(
      input({ payments: [], today: addDays(INVOICED, 60) }),
    );
    expect(result.lines).toContain(
      "Money received more than 90 days after the invoice is cut 25% (30 days left).",
    );
  });
});

describe("calculateCommission: a tier worked out elsewhere", () => {
  it("uses the given tier without a cost and keeps the margin hidden", () => {
    const result = calculateCommission(
      input({ cost: null, knownTier: "high" }),
    );
    expect(result).toMatchObject({
      tier: "high",
      marginPct: null,
      claimable: true,
    });
    expect(result.people[0]?.earned).toBe(4_000);
    expect(result.lines[0]).toBe("Margin is above 45%: +1% extra.");
  });

  it("holds the claim when the tier says the cost is missing", () => {
    const result = calculateCommission(
      input({ cost: null, knownTier: "unknown" }),
    );
    expect(result.claimable).toBe(false);
  });
});

describe("estimatedCommission", () => {
  it("is the value times the base rate", () => {
    const s = DEFAULT_COMMISSION_SETTINGS;
    expect(estimatedCommission(65_000, "own", s)).toBe(1_950);
    expect(estimatedCommission(65_000, "pass_down", s)).toBe(975);
    expect(estimatedCommission(33.34, "own", s)).toBe(1);
  });
});
