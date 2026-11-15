import { describe, expect, it } from "vitest";
import { awayDaysByKind, monthTally, type TallyLog } from "./site-month-tally";

const log = (over: Partial<TallyLog>): TallyLog => ({
  supervisorId: "s1",
  mofId: "m1",
  siteName: null,
  visitedOn: "2026-11-03",
  activity: "inspection",
  handoverSigned: false,
  ...over,
});

describe("monthTally", () => {
  it("counts one visit per site per day, shootings, signed handovers and stock returns", () => {
    const logs = [
      log({ activity: "installation" }),
      log({ activity: "shooting" }),
      log({
        visitedOn: "2026-11-04",
        mofId: "m2",
        activity: "handover",
        handoverSigned: true,
      }),
      log({ visitedOn: "2026-11-05", mofId: "m2", activity: "handover" }),
      log({
        visitedOn: "2026-11-06",
        mofId: null,
        siteName: "Shop",
        activity: "stock_return",
      }),
      log({ visitedOn: "2026-10-30", activity: "shooting" }),
      log({ supervisorId: "s2", activity: "shooting" }),
    ];
    expect(monthTally(logs, "s1", "2026-11-01")).toEqual({
      visits: 4,
      shootings: 1,
      handovers: 1,
      stockReturns: 1,
    });
  });
});

describe("awayDaysByKind", () => {
  const calendar = {
    week: "mon-sat" as const,
    holidays: new Set(["2026-11-10"]),
  };

  it("counts working days in the month, clipped to it and by kind", () => {
    const days = awayDaysByKind(
      [
        { kind: "Office", startsOn: "2026-11-09", endsOn: "2026-11-11" },
        { kind: "Annual leave", startsOn: "2026-10-30", endsOn: "2026-11-02" },
        { kind: "Office", startsOn: "2026-11-14", endsOn: "2026-11-15" },
      ],
      "2026-11-01",
      calendar,
    );
    // 9th and 11th (10th is a holiday) plus Saturday the 14th; Sunday the 15th is off.
    expect(days.get("Office")).toBe(3);
    // 1st is a Sunday, so only Monday the 2nd.
    expect(days.get("Annual leave")).toBe(1);
  });

  it("leaves out ranges wholly outside the month", () => {
    expect(
      awayDaysByKind(
        [{ kind: "Other", startsOn: "2026-10-01", endsOn: "2026-10-05" }],
        "2026-11-01",
        calendar,
      ).size,
    ).toBe(0);
  });
});
