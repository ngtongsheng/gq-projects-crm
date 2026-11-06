import { describe, expect, it } from "vitest";
import {
  type PerformanceOrder,
  type PerformancePerson,
  performanceRows,
} from "./sales-performance";

const DILLON = "11111111-1111-4111-8111-111111111111";
const SARAH = "22222222-2222-4222-8222-222222222222";
const IDLE = "33333333-3333-4333-8333-333333333333";

const people: PerformancePerson[] = [
  { id: SARAH, name: "Sarah", yearlyTarget: 500_000 },
  { id: DILLON, name: "Dillon", yearlyTarget: 1_200_000 },
  { id: IDLE, name: "Idle", yearlyTarget: null },
];

const order = (
  salespersonId: string,
  loaDate: string,
  invoice: number,
  received: number,
  cost: number | null = null,
): PerformanceOrder => ({ salespersonId, loaDate, invoice, received, cost });

const orders = [
  order(DILLON, "2026-01-10", 16_000, 16_000, 9_000),
  order(DILLON, "2026-02-03", 86_000, 80_000, 50_000),
  order(DILLON, "2026-02-20", 4_000, 0),
  order(DILLON, "2025-12-30", 10_000, 10_000, 5_000),
  order(SARAH, "2026-03-05", 4_000, 4_500),
];

describe("performanceRows", () => {
  const { rows, total } = performanceRows(orders, people, 2026);
  const dillon = rows.find((row) => row.personId === DILLON);

  it("lists people with orders or a target, by name, and leaves the idle one out", () => {
    expect(rows.map((row) => row.name)).toEqual(["Dillon", "Sarah"]);
  });

  it("adds sales by LOA month and for the year to date", () => {
    expect(dillon?.months.slice(0, 3)).toEqual([16_000, 90_000, 0]);
    expect(dillon?.ytd).toBe(106_000);
    expect(dillon?.count).toBe(3);
  });

  it("works out achieved against the yearly target", () => {
    expect(dillon?.target).toBe(1_200_000);
    expect(dillon?.achievedPct).toBe(8.8);
  });

  it("works out margin only over orders that have a cost", () => {
    // (16,000 - 9,000) + (86,000 - 50,000) = 43,000 on 102,000 sold
    expect(dillon?.marginYtd).toBe(43_000);
    expect(dillon?.marginPct).toBe(42.2);
  });

  it("counts outstanding and collected over all their orders, any year", () => {
    // invoiced 116,000, received 106,000
    expect(dillon?.outstanding).toBe(10_000);
    expect(dillon?.collectedPct).toBe(91.4);
  });

  it("lets collected pass 100% when someone overpaid, with nothing outstanding", () => {
    const sarah = rows.find((row) => row.personId === SARAH);
    expect(sarah?.collectedPct).toBe(112.5);
    expect(sarah?.outstanding).toBe(0);
  });

  it("has no margin when no order has a cost", () => {
    const sarah = rows.find((row) => row.personId === SARAH);
    expect(sarah?.marginPct).toBeNull();
    expect(sarah?.marginYtd).toBeNull();
  });

  it("totals the team", () => {
    expect(total.ytd).toBe(110_000);
    expect(total.count).toBe(4);
    expect(total.target).toBe(1_700_000);
    expect(total.achievedPct).toBe(6.5);
    expect(total.months[2]).toBe(4_000);
  });

  it("shows no target and no achieved % for someone without one", () => {
    const result = performanceRows(
      [order(IDLE, "2026-05-01", 1_000, 0)],
      people,
      2026,
    );
    const idle = result.rows.find((row) => row.personId === IDLE);
    expect(idle?.target).toBeNull();
    expect(idle?.achievedPct).toBeNull();
    expect(idle?.ytd).toBe(1_000);
  });

  it("hides the year it was not asked for", () => {
    const earlier = performanceRows(orders, people, 2025);
    expect(earlier.rows.find((row) => row.personId === DILLON)?.ytd).toBe(
      10_000,
    );
  });
});
