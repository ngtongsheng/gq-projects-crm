import { describe, expect, it } from "vitest";
import {
  inSiteJobFilter,
  latestInstalled,
  needsFirstVisit,
  nextOnSite,
  parseSiteJobFilter,
  sortSiteJobs,
} from "./site-jobs";

describe("site job filter", () => {
  it("defaults to on-going and ignores unknown values", () => {
    expect(parseSiteJobFilter(undefined)).toBe("ongoing");
    expect(parseSiteJobFilter("x")).toBe("ongoing");
    expect(parseSiteJobFilter("done")).toBe("done");
  });

  it("splits completed jobs from the rest, or shows all", () => {
    expect(inSiteJobFilter("completed", "done")).toBe(true);
    expect(inSiteJobFilter("installation", "done")).toBe(false);
    expect(inSiteJobFilter("installation", "ongoing")).toBe(true);
    expect(inSiteJobFilter("completed", "ongoing")).toBe(false);
    expect(inSiteJobFilter("completed", "all")).toBe(true);
  });
});

describe("latestInstalled", () => {
  const log = (visitedOn: string, instPct: number | null, createdAt = "a") => ({
    activity: "installation" as const,
    instPct,
    visitedOn,
    createdAt,
  });

  it("is the installed % of the latest installation visit", () => {
    expect(
      latestInstalled([log("2026-11-02", 30), log("2026-11-09", 60)]),
    ).toEqual({ pct: 60, on: "2026-11-09" });
  });

  it("breaks a tie on the day by when it was saved", () => {
    expect(
      latestInstalled([log("2026-11-09", 50, "b"), log("2026-11-09", 40, "a")]),
    ).toEqual({ pct: 50, on: "2026-11-09" });
  });

  it("ignores other activities and logs with no %", () => {
    expect(
      latestInstalled([
        { ...log("2026-11-09", 90), activity: "inspection" },
        log("2026-11-10", null),
      ]),
    ).toBeNull();
  });
});

describe("sortSiteJobs", () => {
  it("lists the least progress first, then by MOF number", () => {
    const jobs = [
      {
        mofNo: "P2",
        siteStage: "installation" as const,
        installed: { pct: 100 },
      },
      { mofNo: "P3", siteStage: "start" as const, installed: null },
      { mofNo: "P1", siteStage: "start" as const, installed: null },
    ];
    expect(sortSiteJobs(jobs).map((job) => job.mofNo)).toEqual([
      "P1",
      "P3",
      "P2",
    ]);
  });
});

describe("needsFirstVisit", () => {
  const job = { siteStage: "start" as const, registeredOn: "2026-11-05" };

  it("is true when nothing was logged since the MOF was registered", () => {
    expect(needsFirstVisit(job, [])).toBe(true);
    expect(needsFirstVisit(job, ["2026-11-04"])).toBe(true);
  });

  it("is false once a visit on or after the day exists", () => {
    expect(needsFirstVisit(job, ["2026-11-05"])).toBe(false);
  });

  it("is false for a completed job", () => {
    expect(needsFirstVisit({ ...job, siteStage: "completed" }, [])).toBe(false);
  });
});

describe("nextOnSite", () => {
  const job = (
    scheduledOn: string,
    endsOn: string,
    status: "scheduled" | "done" | "postponed" | "in_progress" = "scheduled",
  ) => ({ jobType: "installation" as const, status, scheduledOn, endsOn });

  it("picks the earliest job that has not ended, done or been postponed", () => {
    const next = job("2026-11-18", "2026-11-18");
    expect(
      nextOnSite(
        [
          job("2026-11-01", "2026-11-05"),
          job("2026-11-16", "2026-11-16", "done"),
          job("2026-11-17", "2026-11-17", "postponed"),
          job("2026-11-20", "2026-11-20"),
          next,
        ],
        "2026-11-15",
      ),
    ).toBe(next);
  });

  it("keeps a job that started earlier and is still running", () => {
    const running = job("2026-11-13", "2026-11-17", "in_progress");
    expect(nextOnSite([running], "2026-11-15")).toBe(running);
  });

  it("is null when nothing is coming", () => {
    expect(nextOnSite([], "2026-11-15")).toBeNull();
  });
});
