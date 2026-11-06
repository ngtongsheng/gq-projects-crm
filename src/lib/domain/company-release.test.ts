import { describe, expect, it } from "vitest";
import {
  daysWithoutVisit,
  isReleased,
  lastVisitByCompany,
  releaseCutoff,
  releasedCompanyIds,
} from "./company-release";

const TODAY = "2026-11-06";

describe("daysWithoutVisit", () => {
  it("counts from the last visit", () => {
    expect(
      daysWithoutVisit(
        { addedOn: "2025-01-01", lastVisit: "2026-07-09" },
        TODAY,
      ),
    ).toBe(120);
  });

  it("counts from the day the company was added when it was never visited", () => {
    expect(
      daysWithoutVisit({ addedOn: "2026-10-27", lastVisit: null }, TODAY),
    ).toBe(10);
  });
});

describe("lastVisitByCompany", () => {
  it("gives each company the latest visit across its customers", () => {
    const contacts = [
      { id: "a1", companyId: "A" },
      { id: "a2", companyId: "A" },
      { id: "b1", companyId: "B" },
    ];
    const latest = lastVisitByCompany(contacts, [
      { contactId: "a1", day: "2026-05-01" },
      { contactId: "a2", day: "2026-08-01" },
      { contactId: "a1", day: "2026-06-01" },
      { contactId: "gone", day: "2026-09-01" },
    ]);
    expect(latest.get("A")).toBe("2026-08-01");
    expect(latest.has("B")).toBe(false);
  });
});

describe("isReleased", () => {
  it("keeps a company visited within 90 days", () => {
    expect(
      isReleased({ addedOn: "2025-01-01", lastVisit: "2026-09-10" }, TODAY),
    ).toBe(false);
  });

  it("keeps a company on the 90th day and releases it on the 91st", () => {
    expect(
      isReleased({ addedOn: "2025-01-01", lastVisit: "2026-08-08" }, TODAY),
    ).toBe(false);
    expect(
      isReleased({ addedOn: "2025-01-01", lastVisit: "2026-08-07" }, TODAY),
    ).toBe(true);
  });

  it("releases a company whose last visit is long ago", () => {
    expect(
      isReleased({ addedOn: "2025-01-01", lastVisit: "2026-02-01" }, TODAY),
    ).toBe(true);
  });

  it("counts a never-visited company from the day it was added", () => {
    expect(isReleased({ addedOn: "2026-10-01", lastVisit: null }, TODAY)).toBe(
      false,
    );
    expect(isReleased({ addedOn: "2026-05-01", lastVisit: null }, TODAY)).toBe(
      true,
    );
  });
});

describe("releasedCompanyIds", () => {
  const contacts = [
    { id: "a1", companyId: "kept" },
    { id: "a2", companyId: "kept" },
    { id: "b1", companyId: "idle" },
    { id: "c1", companyId: "new" },
    { id: "d1", companyId: "never-added" },
  ];
  const companyAddedOn = new Map([
    ["kept", "2025-01-01"],
    ["idle", "2025-01-01"],
    ["new", "2026-10-15"],
  ]);

  it("releases the companies with no recent visit, keeps visited and new ones", () => {
    const released = releasedCompanyIds({
      contacts,
      visitedContactIds: ["a2"],
      companyAddedOn,
      today: TODAY,
    });
    expect([...released].sort()).toEqual(["idle"]);
  });

  it("counts a company once however many customers it has", () => {
    const released = releasedCompanyIds({
      contacts,
      visitedContactIds: [],
      companyAddedOn,
      today: TODAY,
    });
    expect([...released].sort()).toEqual(["idle", "kept"]);
  });

  it("leaves out a company whose date is unknown rather than releasing it", () => {
    const released = releasedCompanyIds({
      contacts: [{ id: "x", companyId: "mystery" }],
      visitedContactIds: [],
      companyAddedOn: new Map(),
      today: TODAY,
    });
    expect(released.size).toBe(0);
  });

  it("has nothing released when there are no customers", () => {
    expect(
      releasedCompanyIds({
        contacts: [],
        visitedContactIds: [],
        companyAddedOn,
        today: TODAY,
      }).size,
    ).toBe(0);
  });
});

describe("releaseCutoff", () => {
  it("is 90 days back", () => {
    expect(releaseCutoff(TODAY)).toBe("2026-08-08");
  });
});
