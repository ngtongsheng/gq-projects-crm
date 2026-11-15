import { describe, expect, test } from "vitest";
import {
  defaultEntitlement,
  type LeaveRequestDays,
  leaveBalance,
  leaveDays,
} from "./leave-balance";
import type { WorkCalendar } from "./workdays";

const calendar = (
  week: WorkCalendar["week"],
  ...holidays: string[]
): WorkCalendar => ({ week, holidays: new Set(holidays) });

const POLICY = { annualDays: 14, mcDays: 14, prorate: true };

describe("leaveDays", () => {
  // 2027-01-08 is a Friday; 2027-01-11 a Monday.
  test("skips the weekend and a public holiday", () => {
    const office = calendar("mon-fri", "2027-01-11");
    expect(leaveDays("2027-01-08", "2027-01-12", false, office)).toBe(2);
  });

  test("a site supervisor's Saturday counts, Sunday never", () => {
    expect(
      leaveDays("2027-01-08", "2027-01-11", false, calendar("mon-sat")),
    ).toBe(3);
    expect(
      leaveDays("2027-01-08", "2027-01-11", false, calendar("mon-fri")),
    ).toBe(2);
  });

  test("a half day is 0.5, or 0 on a day off", () => {
    expect(
      leaveDays("2027-01-08", "2027-01-08", true, calendar("mon-fri")),
    ).toBe(0.5);
    expect(
      leaveDays("2027-01-09", "2027-01-09", true, calendar("mon-fri")),
    ).toBe(0);
  });

  test("a weekend is 0 days, or 1 for a site supervisor", () => {
    expect(
      leaveDays("2027-01-09", "2027-01-10", false, calendar("mon-sat")),
    ).toBe(1);
    expect(
      leaveDays("2027-01-09", "2027-01-10", false, calendar("mon-fri")),
    ).toBe(0);
  });
});

describe("defaultEntitlement", () => {
  test("joining mid-year prorates annual leave from the join month, down to the half day", () => {
    expect(defaultEntitlement(POLICY, "2027-07-15", 2027)).toEqual({
      annualDays: 7,
      carriedDays: 0,
      mcDays: 14,
    });
    // 14 x 11/12 = 12.83 -> 12.5
    expect(defaultEntitlement(POLICY, "2027-02-01", 2027).annualDays).toBe(
      12.5,
    );
    expect(defaultEntitlement(POLICY, "2027-12-31", 2027).annualDays).toBe(1);
  });

  test("full entitlement after the join year, without a join date, or with proration off", () => {
    expect(defaultEntitlement(POLICY, "2027-07-15", 2028).annualDays).toBe(14);
    expect(defaultEntitlement(POLICY, null, 2027).annualDays).toBe(14);
    expect(
      defaultEntitlement({ ...POLICY, prorate: false }, "2027-07-15", 2027)
        .annualDays,
    ).toBe(14);
  });
});

describe("leaveBalance", () => {
  const request = (
    leaveType: LeaveRequestDays["leaveType"],
    status: LeaveRequestDays["status"],
    days: number,
    startsOn = "2027-03-01",
  ): LeaveRequestDays => ({ leaveType, startsOn, status, days });

  const base = {
    year: 2027,
    policy: POLICY,
    joinedOn: "2020-01-01",
    override: null,
    requests: [],
  };

  test("approved leave is taken; pending is shown apart and not deducted", () => {
    const balance = leaveBalance({
      ...base,
      requests: [
        request("annual", "approved", 3),
        request("emergency", "approved", 1),
        request("annual", "pending", 2),
        request("annual", "rejected", 5),
        request("annual", "cancelled", 5),
        request("mc", "approved", 2),
        request("mc", "pending", 1),
        request("hospitalisation", "approved", 4),
        request("unpaid", "approved", 4),
      ],
    });
    expect(balance).toEqual({
      entitlement: { annualDays: 14, carriedDays: 0, mcDays: 14 },
      annualTaken: 4,
      annualPending: 2,
      annualBalance: 10,
      mcTaken: 2,
      mcPending: 1,
      mcBalance: 12,
    });
  });

  test("an override wins over the default, and carried days add to the balance", () => {
    const balance = leaveBalance({
      ...base,
      joinedOn: "2027-07-01",
      override: { annualDays: 16, carriedDays: 2.5, mcDays: 18 },
      requests: [request("annual", "approved", 0.5)],
    });
    expect(balance?.entitlement).toEqual({
      annualDays: 16,
      carriedDays: 2.5,
      mcDays: 18,
    });
    expect(balance?.annualBalance).toBe(18);
    expect(balance?.mcBalance).toBe(18);
  });

  test("leave counts in the year it starts", () => {
    const balance = leaveBalance({
      ...base,
      requests: [
        request("annual", "approved", 3, "2026-12-30"),
        request("annual", "approved", 2, "2027-12-31"),
        request("annual", "approved", 1, "2028-01-03"),
      ],
    });
    expect(balance?.annualTaken).toBe(2);
  });

  test("a year before 2027 has no balance", () => {
    expect(leaveBalance({ ...base, year: 2026 })).toBeNull();
  });
});
