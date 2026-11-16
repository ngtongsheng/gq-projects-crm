import { describe, expect, it } from "vitest";
import {
  type DirectoryInstaller,
  filterInstallers,
  tallyInstallerJobs,
  whatsAppChatLink,
} from "./installer";

const installer = (
  overrides: Partial<DirectoryInstaller>,
): DirectoryInstaller => ({
  name: "Ahmad",
  company: "",
  phone: "",
  phone2: "",
  skills: [],
  description: "",
  area: "",
  notes: "",
  active: true,
  ...overrides,
});

describe("whatsAppChatLink", () => {
  it("opens a chat from a number written the local way", () => {
    expect(whatsAppChatLink("012-345 6789")).toBe("https://wa.me/60123456789");
  });

  it("accepts the country code", () => {
    expect(whatsAppChatLink("+60 12-345 6789")).toBe(
      "https://wa.me/60123456789",
    );
  });

  it("gives no link for something that is not a Malaysian number", () => {
    expect(whatsAppChatLink("call the office")).toBeNull();
    expect(whatsAppChatLink("")).toBeNull();
  });
});

describe("filterInstallers", () => {
  const list = [
    installer({ name: "Zul", skills: ["Timber"] }),
    installer({ name: "Alice", company: "ORION", area: "Penang" }),
    installer({ name: "Hazman", active: false }),
  ];

  it("hides inactive installers unless asked", () => {
    expect(filterInstallers(list, "", false).map((i) => i.name)).toEqual([
      "Alice",
      "Zul",
    ]);
  });

  it("lists active installers first, then inactive ones, each by name", () => {
    expect(filterInstallers(list, "", true).map((i) => i.name)).toEqual([
      "Alice",
      "Zul",
      "Hazman",
    ]);
  });

  it("searches name, company, area and skills regardless of case", () => {
    expect(filterInstallers(list, "orion", false).map((i) => i.name)).toEqual([
      "Alice",
    ]);
    expect(filterInstallers(list, " PENANG ", false)).toHaveLength(1);
    expect(filterInstallers(list, "timber", false).map((i) => i.name)).toEqual([
      "Zul",
    ]);
  });

  it("finds an installer by phone number", () => {
    const withPhone = [installer({ name: "Lee", phone2: "019-888 1111" })];
    expect(filterInstallers(withPhone, "888", false)).toHaveLength(1);
  });
});

describe("tallyInstallerJobs", () => {
  it("counts each installer's jobs and finds the latest start", () => {
    const tally = tallyInstallerJobs([
      { installerId: "a", scheduledOn: "2026-11-02" },
      { installerId: "b", scheduledOn: "2026-10-01" },
      { installerId: "a", scheduledOn: "2026-11-20" },
      { installerId: "a", scheduledOn: "2026-09-15" },
    ]);
    expect(tally.get("a")).toEqual({ jobCount: 3, lastJobOn: "2026-11-20" });
    expect(tally.get("b")).toEqual({ jobCount: 1, lastJobOn: "2026-10-01" });
    expect(tally.get("c")).toBeUndefined();
  });
});
