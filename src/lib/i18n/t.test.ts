import { describe, expect, it } from "vitest";
import { t } from "./t";

describe("t", () => {
  it("returns the English text for English", () => {
    expect(t("en", "Log work")).toBe("Log work");
  });

  it("translates the demo's Bahasa Malaysia site labels", () => {
    expect(t("bm", "Log work")).toBe("Rekod kerja");
    expect(t("bm", "My schedule")).toBe("Jadual saya");
    expect(t("bm", "Site Work")).toBe("Kerja tapak");
    expect(t("bm", "My Report")).toBe("Laporan saya");
  });

  it("translates the demo's Costing wording into Chinese", () => {
    expect(t("zh", "Save")).toBe("保存");
    expect(t("zh", "Create costing")).toBe("建立 costing");
  });

  it("falls back to the English text when a translation is missing", () => {
    expect(t("bm", "Sales Calendar")).toBe("Sales Calendar");
    expect(t("zh", "Sales Calendar")).toBe("Sales Calendar");
  });

  it("does not mistake inherited object keys for translations", () => {
    expect(t("bm", "constructor")).toBe("constructor");
    expect(t("zh", "toString")).toBe("toString");
  });
});
