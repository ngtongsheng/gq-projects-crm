import { describe, expect, it } from "vitest";
import {
  installationHref,
  parseInstallationTab,
  parseInstallerFilter,
} from "./installation-params";

const ID = "11111111-1111-4111-8111-111111111111";

describe("parseInstallationTab", () => {
  it("knows the directory tab and falls back to the calendar", () => {
    expect(parseInstallationTab("contacts")).toBe("contacts");
    expect(parseInstallationTab("nonsense")).toBe("installers");
    expect(parseInstallationTab(undefined)).toBe("installers");
  });
});

describe("parseInstallerFilter", () => {
  it("accepts an installer id and treats anything else as everyone", () => {
    expect(parseInstallerFilter(ID)).toBe(ID);
    expect(parseInstallerFilter("all")).toBeUndefined();
    expect(parseInstallerFilter(undefined)).toBeUndefined();
  });
});

describe("installationHref", () => {
  it("keeps the installer and supervisor filters next to the date", () => {
    expect(
      installationHref({ date: "2026-11-16", who: ID, installer: ID }),
    ).toBe(`/installation?date=2026-11-16&who=${ID}&installer=${ID}`);
  });

  it("adds the installer to a link that had no other parameters", () => {
    expect(installationHref({ installer: ID })).toBe(
      `/installation?installer=${ID}`,
    );
  });

  it("stays the plain path without filters", () => {
    expect(installationHref({})).toBe("/installation");
  });
});
