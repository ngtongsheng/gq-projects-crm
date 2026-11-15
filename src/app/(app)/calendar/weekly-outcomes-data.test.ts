import { describe, expect, it } from "vitest";
import {
  canReviewWeeklyReport,
  defaultOutcomesDate,
  type OutcomeActivity,
  outcomesWeek,
  type WeeklyReport,
  weeklyOutcomes,
} from "./weekly-outcomes-data";

const MEI = "mei";
const ARUN = "arun";
const EDDIE = "eddie";

// Week of Mon 9 Nov 2026; due Fri 13 Nov, 18:00 Malaysia time.
const WEEK = "2026-11-09";
const DUE = new Date("2026-11-13T10:00:00Z");
const BEFORE_DUE = new Date("2026-11-12T02:00:00Z");
const AFTER_DUE = new Date("2026-11-14T02:00:00Z");

let next = 0;
function activity(patch: Partial<OutcomeActivity>): OutcomeActivity {
  next += 1;
  return {
    id: `a${next}`,
    ownerId: MEI,
    type: "visit",
    status: "completed",
    startsAt: "2026-11-10T02:00:00Z",
    result: null,
    outcome: null,
    lateLogged: false,
    loggedAt: "2026-11-10T05:00:00Z",
    leadProjectId: null,
    lead: null,
    customer: "Tan",
    company: "Kayu Sdn Bhd",
    ...patch,
  };
}

function report(patch: Partial<WeeklyReport>): WeeklyReport {
  return {
    id: "r1",
    profileId: MEI,
    status: "submitted",
    note: null,
    submittedAt: "2026-11-13T08:00:00Z",
    late: false,
    reviewNote: null,
    ...patch,
  };
}

const nameOf = new Map([
  [MEI, "Mei"],
  [ARUN, "Arun"],
  [EDDIE, "Eddie"],
]);

function outcomes(input: {
  activities?: OutcomeActivity[];
  reports?: WeeklyReport[];
  scope?: string[] | null;
  filers?: string[];
  now?: Date;
}) {
  return weeklyOutcomes({
    week: WEEK,
    scope: input.scope === undefined ? [MEI] : input.scope,
    filers: new Set(input.filers ?? [MEI, ARUN]),
    nameOf,
    activities: input.activities ?? [],
    reports: input.reports ?? [],
    dueAt: DUE,
    now: input.now ?? AFTER_DUE,
  });
}

describe("weeklyOutcomes counts", () => {
  it("counts visits done, outcomes logged, not logged, late, results and leads", () => {
    const [row] = outcomes({
      activities: [
        activity({ result: "presented" }),
        activity({ result: "presented", lateLogged: true }),
        activity({
          type: "call",
          result: "quotation_requested",
          leadProjectId: "p1",
          lead: { name: "Hotel lobby", value: 12000 },
        }),
        activity({ type: "walk_in", leadProjectId: "p2", lead: null }),
        activity({ status: "planned", loggedAt: null }),
        activity({ status: "cancelled", loggedAt: null }),
        activity({ ownerId: ARUN }),
      ],
    });

    expect(row).toMatchObject({
      id: MEI,
      name: "Mei",
      visitsDone: 3,
      logged: 4,
      notLogged: 1,
      lateLogged: 1,
      leads: 2,
      leadValue: 12000,
    });
    expect(row.results).toEqual([
      { result: "presented", count: 2 },
      { result: "quotation_requested", count: 1 },
    ]);
    expect(row.activities).toHaveLength(5);
  });

  it("does not count a planned visit that has not happened yet as not logged", () => {
    const [row] = outcomes({
      activities: [
        activity({
          status: "planned",
          loggedAt: null,
          startsAt: "2026-11-13T02:00:00Z",
        }),
      ],
      now: BEFORE_DUE,
    });
    expect(row.notLogged).toBe(0);
  });

  it("shows the report state: reviewed, submitted late, due, not submitted, not expected", () => {
    const people = [MEI, ARUN, EDDIE];
    const states = (now: Date, reports: WeeklyReport[]) =>
      outcomes({ scope: people, reports, now }).map((r) => [
        r.name,
        r.report.kind,
      ]);

    expect(states(BEFORE_DUE, [])).toEqual([
      ["Arun", "due"],
      ["Eddie", "not_expected"],
      ["Mei", "due"],
    ]);
    expect(
      states(AFTER_DUE, [
        report({ late: true }),
        report({ id: "r2", profileId: ARUN, status: "reviewed" }),
      ]),
    ).toEqual([
      ["Arun", "reviewed"],
      ["Eddie", "not_expected"],
      ["Mei", "submitted"],
    ]);
    expect(states(AFTER_DUE, [])[2]).toEqual(["Mei", "not_submitted"]);
  });

  it("for everyone, lists the filers plus whoever had appointments", () => {
    const rows = outcomes({
      scope: null,
      filers: [MEI],
      activities: [activity({ ownerId: EDDIE })],
    });
    expect(rows.map((r) => r.name)).toEqual(["Eddie", "Mei"]);
  });
});

describe("week boundaries", () => {
  it("runs Monday to Sunday", () => {
    expect(outcomesWeek("2026-11-15")).toEqual({
      monday: "2026-11-09",
      sunday: "2026-11-15",
    });
    expect(outcomesWeek("2026-11-09").monday).toBe("2026-11-09");
  });

  it("places activities by their Malaysia day, not the UTC day", () => {
    const [row] = outcomes({
      activities: [
        // Mon 9 Nov 00:30 in Malaysia, still Sunday 8 Nov in UTC: this week.
        activity({ startsAt: "2026-11-08T16:30:00Z" }),
        // Sun 8 Nov 23:30 in Malaysia: the week before.
        activity({ startsAt: "2026-11-08T15:30:00Z" }),
        // Sun 15 Nov 23:30 in Malaysia: this week.
        activity({ startsAt: "2026-11-15T15:30:00Z" }),
        // Mon 16 Nov 00:30 in Malaysia: next week.
        activity({ startsAt: "2026-11-15T16:30:00Z" }),
      ],
    });
    expect(row.activities.map((a) => a.startsAt)).toEqual([
      "2026-11-08T16:30:00Z",
      "2026-11-15T15:30:00Z",
    ]);
  });

  it("opens on last week on a Monday, the current week otherwise", () => {
    expect(outcomesWeek(defaultOutcomesDate("2026-11-16")).monday).toBe(
      "2026-11-09",
    );
    expect(outcomesWeek(defaultOutcomesDate("2026-11-15")).monday).toBe(
      "2026-11-09",
    );
    expect(outcomesWeek(defaultOutcomesDate("2026-11-17")).monday).toBe(
      "2026-11-16",
    );
  });
});

describe("canReviewWeeklyReport", () => {
  const team = [EDDIE, MEI];

  it("lets the MD review anyone's report but their own", () => {
    expect(
      canReviewWeeklyReport({ id: "vicky", jobRole: "md" }, MEI, null),
    ).toBe(true);
    expect(
      canReviewWeeklyReport({ id: "vicky", jobRole: "md" }, "vicky", null),
    ).toBe(false);
  });

  it("lets a director review their own team only", () => {
    const eddie = { id: EDDIE, jobRole: "director" as const };
    expect(canReviewWeeklyReport(eddie, MEI, team)).toBe(true);
    expect(canReviewWeeklyReport(eddie, ARUN, team)).toBe(false);
    expect(canReviewWeeklyReport(eddie, EDDIE, team)).toBe(false);
  });

  it("never lets a salesperson review", () => {
    expect(
      canReviewWeeklyReport({ id: ARUN, jobRole: "sales" }, MEI, [ARUN]),
    ).toBe(false);
  });
});
