import { describe, expect, it } from "vitest";
import {
  canCloseFollowUp,
  countSiteVisits,
  FOLLOW_UP_OWNERS,
  isFollowUpOverdue,
  isLowerThanLastInstalled,
  missedLogDays,
  plannedJobsNotRecorded,
  stockReturnWhatsAppText,
  whatsAppLink,
} from "./site-log";

describe("canCloseFollowUp", () => {
  it("lets managers close any follow-up", () => {
    for (const role of ["md", "director", "accounts"] as const) {
      for (const owner of FOLLOW_UP_OWNERS) {
        expect(canCloseFollowUp(role, owner)).toBe(true);
      }
    }
  });

  it("lets only the owning group close its follow-up", () => {
    expect(canCloseFollowUp("sales", "salesperson")).toBe(true);
    expect(canCloseFollowUp("bd", "salesperson")).toBe(true);
    expect(canCloseFollowUp("support", "purchasing")).toBe(true);
    expect(canCloseFollowUp("site", "site_supervisor")).toBe(true);
    expect(canCloseFollowUp("sales", "purchasing")).toBe(false);
    expect(canCloseFollowUp("support", "salesperson")).toBe(false);
    expect(canCloseFollowUp("site", "salesperson")).toBe(false);
  });

  it("leaves installation team and client actions to the site supervisor", () => {
    expect(canCloseFollowUp("site", "installation_team")).toBe(true);
    expect(canCloseFollowUp("site", "client")).toBe(true);
    expect(canCloseFollowUp("sales", "client")).toBe(false);
    expect(canCloseFollowUp("support", "installation_team")).toBe(false);
  });
});

describe("isFollowUpOverdue", () => {
  const today = "2026-11-10";

  it("is overdue once an open follow-up passes its due date", () => {
    expect(isFollowUpOverdue({ dueOn: "2026-11-09", done: false }, today)).toBe(
      true,
    );
  });

  it("is not overdue on the due date, when done, or without a due date", () => {
    expect(isFollowUpOverdue({ dueOn: today, done: false }, today)).toBe(false);
    expect(isFollowUpOverdue({ dueOn: "2026-11-01", done: true }, today)).toBe(
      false,
    );
    expect(isFollowUpOverdue({ dueOn: null, done: false }, today)).toBe(false);
  });
});

describe("isLowerThanLastInstalled", () => {
  it("warns when the installed % drops below the last one", () => {
    expect(isLowerThanLastInstalled(40, 60)).toBe(true);
  });

  it("does not warn for the same or a higher %, or a first entry", () => {
    expect(isLowerThanLastInstalled(60, 60)).toBe(false);
    expect(isLowerThanLastInstalled(80, 60)).toBe(false);
    expect(isLowerThanLastInstalled(0, null)).toBe(false);
  });
});

describe("countSiteVisits", () => {
  it("counts one visit per site per day in the month", () => {
    const visits = countSiteVisits(
      [
        { visitedOn: "2026-11-02", mofId: "mof-a", siteName: null },
        { visitedOn: "2026-11-02", mofId: "mof-a", siteName: null },
        { visitedOn: "2026-11-02", mofId: "mof-b", siteName: null },
        { visitedOn: "2026-11-03", mofId: "mof-a", siteName: null },
        { visitedOn: "2026-11-03", mofId: null, siteName: "Menara KL" },
        { visitedOn: "2026-11-03", mofId: null, siteName: "menara kl" },
        { visitedOn: "2026-10-31", mofId: "mof-a", siteName: null },
      ],
      "2026-11-01",
    );
    expect(visits).toBe(4);
  });
});

// 2026-11-16 is a Monday; the week before runs Mon 9 to Sun 15.
const TODAY = "2026-11-16";
const noDaysOff = { holidays: new Set<string>(), away: [], joinedOn: null };

describe("missedLogDays", () => {
  it("lists the past week's Monday to Saturday days with no log, oldest first", () => {
    expect(
      missedLogDays({
        today: TODAY,
        ...noDaysOff,
        loggedDays: ["2026-11-10", "2026-11-12", "2026-11-16"],
      }),
    ).toEqual(["2026-11-09", "2026-11-11", "2026-11-13", "2026-11-14"]);
  });

  it("skips public holidays, approved leave and office days", () => {
    expect(
      missedLogDays({
        today: TODAY,
        holidays: new Set(["2026-11-09"]),
        away: [
          { startsOn: "2026-11-10", endsOn: "2026-11-11" },
          { startsOn: "2026-11-14", endsOn: "2026-11-14" },
        ],
        joinedOn: null,
        loggedDays: [],
      }),
    ).toEqual(["2026-11-12", "2026-11-13"]);
  });

  it("starts from the day they joined", () => {
    expect(
      missedLogDays({
        today: TODAY,
        ...noDaysOff,
        joinedOn: "2026-11-13",
        loggedDays: [],
      }),
    ).toEqual(["2026-11-13", "2026-11-14"]);
  });
});

describe("plannedJobsNotRecorded", () => {
  const job = (day: string, fields: Record<string, string | null> = {}) => ({
    day,
    mofId: null,
    projectId: null,
    siteName: null,
    ...fields,
  });

  it("lists planned jobs with no log at that site that day", () => {
    const planned = [
      job("2026-11-10", { mofId: "mof-a" }),
      job("2026-11-11", { mofId: "mof-a" }),
      job("2026-11-12", { projectId: "proj-b" }),
      job("2026-11-13", { siteName: "Menara KL" }),
      job("2026-11-13", { siteName: "Wisma Hijau" }),
    ];
    const logs = [
      {
        visitedOn: "2026-11-10",
        mofId: "mof-a",
        projectId: null,
        siteName: null,
      },
      {
        visitedOn: "2026-11-11",
        mofId: "mof-z",
        projectId: null,
        siteName: null,
      },
      {
        visitedOn: "2026-11-12",
        mofId: "mof-b",
        projectId: "proj-b",
        siteName: null,
      },
      {
        visitedOn: "2026-11-13",
        mofId: null,
        projectId: null,
        siteName: "menara kl",
      },
    ];

    expect(
      plannedJobsNotRecorded({ today: TODAY, ...noDaysOff, planned, logs }),
    ).toEqual([planned[1], planned[4]]);
  });

  it("leaves out today, Sundays, holidays and days away", () => {
    const planned = [
      job("2026-11-16", { mofId: "mof-a" }),
      job("2026-11-15", { mofId: "mof-a" }),
      job("2026-11-09", { mofId: "mof-a" }),
      job("2026-11-10", { mofId: "mof-a" }),
      job("2026-11-08", { mofId: "mof-a" }),
    ];

    expect(
      plannedJobsNotRecorded({
        today: TODAY,
        holidays: new Set(["2026-11-09"]),
        away: [{ startsOn: "2026-11-10", endsOn: "2026-11-10" }],
        joinedOn: null,
        planned,
        logs: [],
      }),
    ).toEqual([]);
  });
});

describe("stockReturnWhatsAppText", () => {
  const message = {
    mofNo: "M2611-004",
    siteName: "Menara KL",
    items: [
      { qty: 3, unit: "box", item: "Carpet tile Grey" },
      { qty: 1, unit: "roll", item: "Vinyl Oak" },
    ],
    way: "transport" as const,
    supervisorName: "Awal",
    on: "2026-11-16",
  };

  it("lists the balance stock left on site", () => {
    expect(stockReturnWhatsAppText({ ...message, sentBack: false })).toBe(
      [
        "Balance stock to return: M2611-004 Menara KL",
        "• 3 box Carpet tile Grey",
        "• 1 roll Vinyl Oak",
        "How: Need transport, office to arrange (Lalamove / lorry)",
        "From: Awal, 16 Nov 2026",
        "(Photo attached)",
      ].join("\n"),
    );
  });

  it("asks purchasing to record a stock return sent back today", () => {
    const text = stockReturnWhatsAppText({ ...message, sentBack: true });
    expect(text.startsWith("Stock return today: M2611-004")).toBe(true);
    expect(text.endsWith("back to supplier or keep at Best Link.")).toBe(true);
  });

  it("opens WhatsApp with the text, to the office number when known", () => {
    expect(whatsAppLink("60123456789", "a b")).toBe(
      "https://wa.me/60123456789?text=a%20b",
    );
    expect(whatsAppLink(null, "a")).toBe("https://wa.me/?text=a");
  });
});
