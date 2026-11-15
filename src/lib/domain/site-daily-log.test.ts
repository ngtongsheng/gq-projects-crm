import { describe, expect, it } from "vitest";
import { dailyLogCell, gridDays, planVsDone } from "./site-daily-log";
import type { LoggedSiteJob, PlannedSiteJob } from "./site-log";

// 2026-11-11 is a Wednesday; 2026-11-08 a Sunday.
const today = "2026-11-11";
const calendar = {
  week: "mon-sat" as const,
  holidays: new Set(["2026-11-09"]),
};

const cell = (change: Partial<Parameters<typeof dailyLogCell>[0]> = {}) =>
  dailyLogCell({
    day: "2026-11-10",
    today,
    calendar,
    sitesLogged: 0,
    awayLabel: null,
    joinedOn: null,
    reminderTimePassed: false,
    ...change,
  });

describe("dailyLogCell", () => {
  it("asks nothing on a Sunday or a public holiday", () => {
    expect(cell({ day: "2026-11-08" })).toEqual({
      kind: "no-site-work",
      reason: "sunday",
    });
    expect(cell({ day: "2026-11-09" })).toEqual({
      kind: "no-site-work",
      reason: "holiday",
    });
  });

  it("shows how many sites were logged", () => {
    expect(cell({ sitesLogged: 2 })).toEqual({ kind: "logged", sites: 2 });
  });

  it("shows the reason for a day away", () => {
    expect(cell({ awayLabel: "MC" })).toEqual({ kind: "away", label: "MC" });
  });

  it("counts a log above a day away", () => {
    expect(cell({ sitesLogged: 1, awayLabel: "Office" })).toEqual({
      kind: "logged",
      sites: 1,
    });
  });

  it("is not missing yet today, and says whether the reminder time has passed", () => {
    expect(cell({ day: today })).toEqual({
      kind: "today",
      reminderGone: false,
    });
    expect(cell({ day: today, reminderTimePassed: true })).toEqual({
      kind: "today",
      reminderGone: true,
    });
  });

  it("leaves days before they joined empty and flags the rest as missing", () => {
    expect(cell({ joinedOn: "2026-11-11" })).toEqual({ kind: "before-joined" });
    expect(cell()).toEqual({ kind: "missing" });
  });
});

describe("gridDays", () => {
  it("ends today, oldest first", () => {
    expect(gridDays(today, 3)).toEqual(["2026-11-09", "2026-11-10", today]);
  });
});

const job = (change: Partial<PlannedSiteJob> = {}): PlannedSiteJob => ({
  day: "2026-11-10",
  mofId: "mof-1",
  projectId: null,
  siteName: null,
  ...change,
});

const logged = (change: Partial<LoggedSiteJob> = {}): LoggedSiteJob => ({
  visitedOn: "2026-11-10",
  mofId: "mof-1",
  siteName: null,
  projectId: null,
  ...change,
});

describe("planVsDone", () => {
  const base = { today, holidays: calendar.holidays, away: [], joinedOn: null };

  it("splits the plan into done and not logged, and finds sites added on the day", () => {
    const result = planVsDone({
      ...base,
      planned: [job(), job({ mofId: "mof-2" })],
      logs: [logged(), logged({ mofId: "mof-9" })],
    });
    expect(result.planned).toHaveLength(2);
    expect(result.done.map((planned) => planned.mofId)).toEqual(["mof-1"]);
    expect(result.notLogged.map((planned) => planned.mofId)).toEqual(["mof-2"]);
    expect(result.addedOnTheDay.map((log) => log.mofId)).toEqual(["mof-9"]);
  });

  it("does not count a planned job on a day they were away as not logged", () => {
    const result = planVsDone({
      ...base,
      away: [{ startsOn: "2026-11-10", endsOn: "2026-11-10" }],
      planned: [job()],
      logs: [],
    });
    expect(result.planned).toHaveLength(1);
    expect(result.notLogged).toEqual([]);
  });

  it("counts a site logged twice on a day once", () => {
    const result = planVsDone({
      ...base,
      planned: [],
      logs: [logged(), logged()],
    });
    expect(result.addedOnTheDay).toHaveLength(1);
  });
});
