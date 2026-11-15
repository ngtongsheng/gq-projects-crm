import { describe, expect, test } from "vitest";
import {
  alsoAway,
  approverLine,
  balanceAfter,
  balanceFor,
  entitlementFor,
  type LeavePerson,
  type LeaveRow,
  type LeaveSetup,
  leaveDates,
  myLeave,
  overrideKey,
  teamLeaveRows,
  waitingForMe,
} from "./leave-view";

const ANNA = "00000000-0000-4000-8000-000000000001";
const BEN = "00000000-0000-4000-8000-000000000002";
const LEAD = "00000000-0000-4000-8000-000000000003";

function leave(over: Partial<LeaveRow> & { id: string }): LeaveRow {
  return {
    personId: ANNA,
    leaveType: "annual",
    status: "approved",
    startsOn: "2027-03-01",
    endsOn: "2027-03-02",
    halfDay: null,
    days: 2,
    reason: "",
    hasSlip: false,
    slipFileName: null,
    originalGivenToHr: false,
    appliedOn: "2027-02-20",
    decidedById: null,
    decidedOn: null,
    decisionNote: "",
    steps: [{ position: 1, approverRole: "md", decision: null }],
    ...over,
  };
}

const setup: LeaveSetup = {
  policy: { annualDays: 14, mcDays: 14, prorate: true },
  overrides: new Map(),
};
const anna: LeavePerson = {
  id: ANNA,
  name: "Anna",
  jobRole: "support",
  joinedOn: "2020-01-01",
  reportsTo: null,
};

describe("balanceFor", () => {
  test("counts only that person's approved leave against the year", () => {
    const rows = [
      leave({ id: "a", days: 3 }),
      leave({ id: "b", personId: BEN, days: 5 }),
      leave({ id: "c", status: "pending", days: 1 }),
    ];
    const balance = balanceFor(rows, anna, 2027, setup);
    expect(balance?.annualBalance).toBe(11);
    expect(balance?.annualPending).toBe(1);
  });

  test("a person's override replaces the company default for that year only", () => {
    const withCarry: LeaveSetup = {
      ...setup,
      overrides: new Map([
        [
          overrideKey(ANNA, 2027),
          { annualDays: 14, carriedDays: 3, mcDays: 14 },
        ],
      ]),
    };
    expect(balanceFor([], anna, 2027, withCarry)?.annualBalance).toBe(17);
    expect(balanceFor([], anna, 2028, withCarry)?.annualBalance).toBe(14);
  });

  test("there is no balance before 2027", () => {
    expect(balanceFor([], anna, 2026, setup)).toBeNull();
  });
});

describe("entitlementFor", () => {
  test("the override when there is one, otherwise the prorated company default", () => {
    const overridden: LeaveSetup = {
      ...setup,
      overrides: new Map([
        [
          overrideKey(ANNA, 2027),
          { annualDays: 16, carriedDays: 2, mcDays: 14 },
        ],
      ]),
    };
    expect(entitlementFor(anna, 2027, overridden)).toEqual({
      entitlement: { annualDays: 16, carriedDays: 2, mcDays: 14 },
      isOverride: true,
    });
    const joined = { ...anna, joinedOn: "2027-07-10" };
    expect(entitlementFor(joined, 2027, setup)).toEqual({
      entitlement: { annualDays: 7, carriedDays: 0, mcDays: 14 },
      isOverride: false,
    });
  });
});

describe("balanceAfter", () => {
  const balance = balanceFor([], anna, 2027, setup);

  test("annual and emergency leave come off annual leave, MC off MC", () => {
    expect(balanceAfter("annual", 2, balance)).toBe(12);
    expect(balanceAfter("emergency", 1, balance)).toBe(13);
    expect(balanceAfter("mc", 3, balance)).toBe(11);
  });

  test("other types take nothing off a balance", () => {
    expect(balanceAfter("unpaid", 2, balance)).toBeNull();
    expect(balanceAfter("hospitalisation", 2, balance)).toBeNull();
  });

  test("goes negative when it is more than what is left", () => {
    expect(balanceAfter("annual", 20, balance)).toBe(-6);
  });

  test("is unknown without a balance", () => {
    expect(balanceAfter("annual", 2, null)).toBeNull();
  });
});

describe("myLeave and waitingForMe", () => {
  test("my leave is this person's, in the year it starts, latest first", () => {
    const rows = [
      leave({ id: "a", startsOn: "2027-03-01" }),
      leave({ id: "b", startsOn: "2027-09-01", endsOn: "2027-09-01" }),
      leave({ id: "c", startsOn: "2026-12-30", endsOn: "2027-01-04" }),
      leave({ id: "d", personId: BEN }),
    ];
    expect(myLeave(rows, ANNA, 2027).map((row) => row.id)).toEqual(["b", "a"]);
  });

  test("waiting leave is only what this person may decide now, oldest first", () => {
    const rows = [
      leave({ id: "new", status: "pending", appliedOn: "2027-02-22" }),
      leave({ id: "old", status: "pending", appliedOn: "2027-02-20" }),
      leave({ id: "done" }),
      leave({ id: "own", status: "pending", personId: BEN }),
    ];
    const asMd = waitingForMe(rows, { id: BEN, jobRole: "md" });
    expect(asMd.map((row) => row.id)).toEqual(["old", "new"]);
    expect(waitingForMe(rows, { id: LEAD, jobRole: "sales" })).toEqual([]);
  });
});

describe("alsoAway", () => {
  test("lists other people approved on any of the same days, once each", () => {
    const request = leave({
      id: "r",
      status: "pending",
      startsOn: "2027-03-02",
      endsOn: "2027-03-04",
    });
    const rows = [
      request,
      leave({
        id: "x",
        personId: BEN,
        startsOn: "2027-03-04",
        endsOn: "2027-03-05",
      }),
      leave({
        id: "y",
        personId: BEN,
        startsOn: "2027-03-02",
        endsOn: "2027-03-02",
      }),
      leave({
        id: "z",
        personId: LEAD,
        status: "pending",
        startsOn: "2027-03-03",
        endsOn: "2027-03-03",
      }),
      leave({
        id: "w",
        personId: LEAD,
        startsOn: "2027-03-08",
        endsOn: "2027-03-09",
      }),
    ];
    expect(alsoAway(request, rows)).toEqual([BEN]);
  });
});

describe("leaveDates", () => {
  test("a single day, a half day and a range", () => {
    expect(
      leaveDates(
        leave({ id: "a", startsOn: "2027-03-01", endsOn: "2027-03-01" }),
      ),
    ).toBe("1 Mar 2027");
    expect(
      leaveDates(
        leave({
          id: "a",
          startsOn: "2027-03-01",
          endsOn: "2027-03-01",
          halfDay: "pm",
        }),
      ),
    ).toBe("1 Mar 2027 (PM)");
    expect(leaveDates(leave({ id: "a" }))).toBe("1 Mar – 2 Mar 2027");
  });

  test("keeps both years when the range crosses new year", () => {
    expect(
      leaveDates(
        leave({ id: "a", startsOn: "2027-12-30", endsOn: "2028-01-03" }),
      ),
    ).toBe("30 Dec 2027 – 3 Jan 2028");
  });
});

describe("teamLeaveRows", () => {
  const ben: LeavePerson = { ...anna, id: BEN, name: "Ben" };

  test("one row per person by name, with the next open leave and missing slips", () => {
    const rows = [
      leave({ id: "past", startsOn: "2027-01-05", endsOn: "2027-01-05" }),
      leave({
        id: "next",
        status: "pending",
        startsOn: "2027-05-10",
        endsOn: "2027-05-11",
      }),
      leave({ id: "later", startsOn: "2027-08-10", endsOn: "2027-08-11" }),
      leave({
        id: "cancelled",
        status: "cancelled",
        startsOn: "2027-04-01",
        endsOn: "2027-04-01",
      }),
      leave({
        id: "mc",
        leaveType: "mc",
        startsOn: "2027-02-01",
        endsOn: "2027-02-01",
        days: 1,
      }),
    ];
    const result = teamLeaveRows([ben, anna], rows, 2027, setup, "2027-03-01");
    expect(result.map((row) => row.person.name)).toEqual(["Anna", "Ben"]);
    expect(result[0].next?.id).toBe("next");
    expect(result[0].slipsMissing).toBe(1);
    expect(result[1].next).toBeNull();
  });
});

describe("approverLine", () => {
  const nameOf = (id: string) => (id === LEAD ? "Lee" : "Unnamed");

  test("a salesperson's team lead by name, then the MD by title", () => {
    expect(approverLine({ jobRole: "sales", teamLeadId: LEAD }, nameOf)).toBe(
      "Lee or Managing Director",
    );
  });

  test("the others by job title", () => {
    expect(approverLine({ jobRole: "site", teamLeadId: null }, nameOf)).toBe(
      "Sales Director or Managing Director",
    );
    expect(approverLine({ jobRole: "md", teamLeadId: null }, nameOf)).toBe(
      "Sales Director",
    );
    expect(
      approverLine({ jobRole: "designer", teamLeadId: null }, nameOf),
    ).toBe("Managing Director");
  });
});
