import { describe, expect, it } from "vitest";
import {
  bestMonth,
  joinNote,
  type PerformanceOrder,
  type PerformancePerson,
  performanceRows,
  personMofs,
  proratedTarget,
  teamComparison,
} from "./sales-performance";

const DILLON = "11111111-1111-4111-8111-111111111111";
const SARAH = "22222222-2222-4222-8222-222222222222";
const IDLE = "33333333-3333-4333-8333-333333333333";

const EDDIE = "44444444-4444-4444-8444-444444444444";
const MICHELLE = "55555555-5555-4555-8555-555555555555";

const person = (
  id: string,
  name: string,
  yearlyTarget: number | null,
  more: Partial<PerformancePerson> = {},
): PerformancePerson => ({
  id,
  name,
  yearlyTarget,
  joinedOn: null,
  leftOn: null,
  jobRole: "sales",
  reportsTo: null,
  ...more,
});

const people: PerformancePerson[] = [
  person(SARAH, "Sarah", 500_000),
  person(DILLON, "Dillon", 1_200_000),
  person(IDLE, "Idle", null),
];

const order = (
  salespersonId: string,
  loaDate: string,
  contractSum: number,
  received: number,
  cost: number | null = null,
  variationOrders: PerformanceOrder["variationOrders"] = [],
): PerformanceOrder => ({
  mofId: `mof-${salespersonId.slice(0, 2)}-${loaDate}-${contractSum}`,
  mofNo: `MOF-${loaDate}`,
  projectName: "Lobby carpet",
  companyName: "Acme",
  stage: "ordered",
  salespersonId,
  loaDate,
  contractSum,
  variationOrders,
  received,
  cost,
});

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

  describe("variation orders", () => {
    const withVo = [
      order(DILLON, "2026-02-03", 10_000, 0, null, [
        // backfilled VO: dated at the LOA, so it stays in the MOF month
        { confirmedOn: "2026-02-03", amount: 1_000 },
        { confirmedOn: "2026-05-14", amount: 2_500 },
      ]),
    ];
    const result = performanceRows(withVo, people, 2026);
    const dillon = result.rows.find((row) => row.personId === DILLON);

    it("moves only the VO's amount to its confirmed month", () => {
      expect(dillon?.months[1]).toBe(11_000);
      expect(dillon?.months[4]).toBe(2_500);
      expect(dillon?.ytd).toBe(13_500);
    });

    it("counts the order once and owes on the full invoice", () => {
      expect(dillon?.count).toBe(1);
      expect(dillon?.outstanding).toBe(13_500);
    });

    it("counts a VO confirmed in a later year in that year, not the LOA year", () => {
      const later = [
        order(DILLON, "2025-12-20", 10_000, 0, null, [
          { confirmedOn: "2026-01-08", amount: 700 },
        ]),
      ];
      const y2026 = performanceRows(later, people, 2026);
      const y2025 = performanceRows(later, people, 2025);
      expect(y2026.rows[0]?.months[0]).toBe(700);
      expect(y2026.rows[0]?.count).toBe(0);
      expect(y2025.rows[0]?.ytd).toBe(10_000);
    });

    it("subtracts an omission in its own month", () => {
      const cut = performanceRows(
        [
          order(SARAH, "2026-03-05", 4_000, 0, null, [
            { confirmedOn: "2026-04-01", amount: -500 },
          ]),
        ],
        people,
        2026,
      );
      expect(cut.rows.find((row) => row.personId === SARAH)?.months[3]).toBe(
        -500,
      );
    });
  });

  it("hides the year it was not asked for", () => {
    const earlier = performanceRows(orders, people, 2025);
    expect(earlier.rows.find((row) => row.personId === DILLON)?.ytd).toBe(
      10_000,
    );
  });

  describe("prorated targets", () => {
    it("keeps the full target for someone here all year", () => {
      expect(proratedTarget(365_000, null, null, 2026)).toBe(365_000);
      expect(proratedTarget(365_000, "2020-06-01", null, 2026)).toBe(365_000);
    });

    it("counts only the days from the join date in the year they joined", () => {
      // 1 Jul to 31 Dec is 184 of 365 days
      expect(proratedTarget(365_000, "2026-07-01", null, 2026)).toBe(184_000);
    });

    it("counts only the days up to the leave date in the year they left", () => {
      // 1 Jan to 31 Mar is 90 of 365 days
      expect(proratedTarget(365_000, null, "2026-03-31", 2026)).toBe(90_000);
    });

    it("handles a join and a leave in the same year", () => {
      // 1 Apr to 30 Jun is 91 of 365 days
      expect(proratedTarget(365_000, "2026-04-01", "2026-06-30", 2026)).toBe(
        91_000,
      );
    });

    it("counts a leap year by its 366 days so a whole year still reaches the target", () => {
      expect(proratedTarget(366_000, null, null, 2028)).toBe(366_000);
      expect(proratedTarget(366_000, "2028-07-01", null, 2028)).toBe(184_000);
    });

    it("is zero before the join year and after the leave year", () => {
      expect(proratedTarget(365_000, "2027-02-01", null, 2026)).toBe(0);
      expect(proratedTarget(365_000, null, "2025-11-30", 2026)).toBe(0);
    });

    it("feeds the row: target, full target and achieved use the cut target", () => {
      const joiner = [
        person(SARAH, "Sarah", 365_000, { joinedOn: "2026-07-01" }),
      ];
      const { rows, total } = performanceRows(
        [order(SARAH, "2026-08-01", 92_000, 0)],
        joiner,
        2026,
      );
      expect(rows[0]?.target).toBe(184_000);
      expect(rows[0]?.fullTarget).toBe(365_000);
      expect(rows[0]?.achievedPct).toBe(50);
      expect(total.target).toBe(184_000);
    });

    it("leaves out someone who left before the year, unless they sold in it", () => {
      const gone = [person(SARAH, "Sarah", 365_000, { leftOn: "2025-05-01" })];
      expect(performanceRows([], gone, 2026).rows).toEqual([]);
      const sold = performanceRows(
        [order(SARAH, "2026-01-05", 1_000, 0)],
        gone,
        2026,
      );
      expect(sold.rows[0]?.target).toBeNull();
      expect(sold.rows[0]?.ytd).toBe(1_000);
    });
  });

  describe("joinNote", () => {
    it("says Joined in the year they joined and Joins before they have", () => {
      expect(joinNote("2026-03-03", 2026, "2026-11-15")).toEqual({
        kind: "joined",
        date: "2026-03-03",
      });
      expect(joinNote("2026-12-01", 2026, "2026-11-15")).toEqual({
        kind: "joins",
        date: "2026-12-01",
      });
    });

    it("says nothing for someone who joined in an earlier year, or without a date", () => {
      expect(joinNote("2024-03-03", 2026, "2026-11-15")).toBeNull();
      expect(joinNote(null, 2026, "2026-11-15")).toBeNull();
    });
  });

  describe("bestMonth", () => {
    it("finds the month with the most sales", () => {
      expect(bestMonth([0, 5_000, 12_000, 0, 700])).toEqual({
        index: 2,
        amount: 12_000,
      });
    });

    it("takes the earliest month when months tie", () => {
      expect(bestMonth([1_000, 9_000, 3_000, 9_000])).toEqual({
        index: 1,
        amount: 9_000,
      });
    });

    it("is null when nothing sold or the year netted out below zero", () => {
      expect(bestMonth(Array(12).fill(0))).toBeNull();
      expect(bestMonth([0, -500])).toBeNull();
    });
  });

  describe("a director with no awarded sales", () => {
    const directors = [
      person(EDDIE, "Eddie", 600_000, { jobRole: "director" }),
      person(MICHELLE, "Michelle", 600_000, { jobRole: "director" }),
      person(SARAH, "Sarah", 500_000),
    ];

    it("is hidden, target or not, while one who sold stays", () => {
      const { rows } = performanceRows(
        [order(MICHELLE, "2026-02-01", 10_000, 0)],
        directors,
        2026,
      );
      expect(rows.map((row) => row.name)).toEqual(["Michelle", "Sarah"]);
    });

    it("shows once they have an order from any year", () => {
      const { rows } = performanceRows(
        [order(EDDIE, "2024-02-01", 10_000, 0)],
        directors,
        2026,
      );
      expect(rows.map((row) => row.name)).toContain("Eddie");
    });
  });

  describe("teamComparison", () => {
    const staff = [
      person(EDDIE, "Eddie", 600_000, { jobRole: "director" }),
      person(MICHELLE, "Michelle", 600_000, { jobRole: "director" }),
      person(DILLON, "Dillon", 300_000, { reportsTo: EDDIE }),
      person(SARAH, "Sarah", 200_000, { reportsTo: MICHELLE }),
    ];
    const teams = teamComparison(
      [
        order(EDDIE, "2026-01-05", 5_000, 0),
        order(DILLON, "2026-01-20", 20_000, 0),
        order(SARAH, "2026-02-02", 8_000, 0),
      ],
      staff,
      2026,
    );

    it("counts each director in their own team with the people under them", () => {
      expect(teams.map((team) => team.memberNames)).toEqual([
        ["Eddie", "Dillon"],
        ["Michelle", "Sarah"],
      ]);
      expect(teams[0]?.row.ytd).toBe(25_000);
      expect(teams[0]?.row.target).toBe(900_000);
      expect(teams[1]?.row.months[1]).toBe(8_000);
    });

    it("is one team when only one director leads", () => {
      expect(teamComparison([], staff.slice(0, 1), 2026)).toHaveLength(1);
    });
  });

  describe("personMofs", () => {
    const list = personMofs(
      [
        order(DILLON, "2026-01-10", 16_000, 6_000, 9_000),
        order(DILLON, "2026-02-03", 10_000, 12_000, null, [
          { confirmedOn: "2026-05-01", amount: 2_000 },
        ]),
        order(DILLON, "2025-12-30", 10_000, 0),
        order(SARAH, "2026-03-05", 4_000, 0),
      ],
      DILLON,
      2026,
    );

    it("lists the person's MOFs registered in the year, newest first", () => {
      expect(list.map((line) => line.loaDate)).toEqual([
        "2026-02-03",
        "2026-01-10",
      ]);
    });

    it("shows sales with variation orders, collected and outstanding", () => {
      expect(list[0]?.sales).toBe(12_000);
      expect(list[0]?.collectedPct).toBe(100);
      expect(list[0]?.outstanding).toBe(0);
      expect(list[1]?.collectedPct).toBe(37.5);
      expect(list[1]?.outstanding).toBe(10_000);
    });

    it("works margin out only for an order with a cost", () => {
      expect(list[1]?.marginRm).toBe(7_000);
      expect(list[1]?.marginPct).toBe(43.8);
      expect(list[0]?.marginRm).toBeNull();
      expect(list[0]?.marginPct).toBeNull();
    });
  });
});
