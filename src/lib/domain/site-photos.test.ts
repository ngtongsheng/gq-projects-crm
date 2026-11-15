import { describe, expect, it } from "vitest";
import {
  canCancelShootRequest,
  canMarkPhotosPosted,
  canReceiveMeasurement,
  canRequestShoot,
  canSaveToDrive,
  dueState,
  isDriveFolderLink,
} from "./site-photos";

const person = (jobRole: Parameters<typeof canRequestShoot>[0], id = "me") => ({
  id,
  jobRole,
});

describe("canRequestShoot", () => {
  it("lets sales, BD, MD, the Sales Director and marketing ask", () => {
    for (const role of [
      "sales",
      "bd",
      "md",
      "director",
      "marketing",
    ] as const) {
      expect(canRequestShoot(role)).toBe(true);
    }
    for (const role of ["site", "support", "ssup", "accounts"] as const) {
      expect(canRequestShoot(role)).toBe(false);
    }
  });
});

describe("canReceiveMeasurement", () => {
  it("is the salesperson it was sent to or a manager", () => {
    expect(canReceiveMeasurement(person("sales"), { toId: "me" })).toBe(true);
    expect(canReceiveMeasurement(person("sales"), { toId: "other" })).toBe(
      false,
    );
    expect(canReceiveMeasurement(person("sales"), { toId: null })).toBe(false);
    expect(canReceiveMeasurement(person("md"), { toId: "other" })).toBe(true);
  });
});

describe("canMarkPhotosPosted", () => {
  it("is the supervisor who logged them or a manager", () => {
    expect(canMarkPhotosPosted(person("site"), { supervisorId: "me" })).toBe(
      true,
    );
    expect(canMarkPhotosPosted(person("site"), { supervisorId: "x" })).toBe(
      false,
    );
    expect(canMarkPhotosPosted(person("director"), { supervisorId: "x" })).toBe(
      true,
    );
  });
});

describe("canSaveToDrive", () => {
  it("is the person they went to, a manager, Purchasing or Sales support", () => {
    expect(canSaveToDrive(person("marketing"), { toId: "me" })).toBe(true);
    expect(canSaveToDrive(person("ssup"), { toId: null })).toBe(true);
    expect(canSaveToDrive(person("support"), { toId: "x" })).toBe(true);
    expect(canSaveToDrive(person("md"), { toId: "x" })).toBe(true);
    expect(canSaveToDrive(person("site"), { toId: "x" })).toBe(false);
    expect(canSaveToDrive(person("marketing"), { toId: "x" })).toBe(false);
  });
});

describe("canCancelShootRequest", () => {
  it("is whoever asked or a manager", () => {
    expect(canCancelShootRequest(person("bd"), { createdById: "me" })).toBe(
      true,
    );
    expect(canCancelShootRequest(person("bd"), { createdById: "x" })).toBe(
      false,
    );
    expect(canCancelShootRequest(person("md"), { createdById: "x" })).toBe(
      true,
    );
  });
});

describe("isDriveFolderLink", () => {
  it("accepts Google Drive and Docs addresses only", () => {
    expect(
      isDriveFolderLink("https://drive.google.com/drive/folders/abc"),
    ).toBe(true);
    expect(isDriveFolderLink("https://docs.google.com/document/d/1")).toBe(
      true,
    );
    expect(isDriveFolderLink("http://drive.google.com/x")).toBe(false);
    expect(isDriveFolderLink("https://evil.test/drive.google.com/")).toBe(
      false,
    );
    expect(isDriveFolderLink("https://dropbox.com/x")).toBe(false);
  });
});

describe("dueState", () => {
  it("compares the due day with today", () => {
    expect(dueState("2026-11-14", "2026-11-15")).toBe("overdue");
    expect(dueState("2026-11-15", "2026-11-15")).toBe("today");
    expect(dueState("2026-11-16", "2026-11-15")).toBe("later");
  });
});
