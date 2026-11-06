import { describe, expect, it } from "vitest";
import { isReleased, releaseCutoff } from "./company-release";

const TODAY = "2026-11-06";

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

describe("releaseCutoff", () => {
  it("is 90 days back", () => {
    expect(releaseCutoff(TODAY)).toBe("2026-08-08");
  });
});
