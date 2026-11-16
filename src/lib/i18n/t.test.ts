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

  it("translates the Site Work tabs and the labels behind them into Bahasa Malaysia", () => {
    expect(t("bm", "Actions needed")).toBe("Tindakan diperlukan");
    expect(t("bm", "Installation in progress")).toBe(
      "Pemasangan sedang berjalan",
    );
    expect(t("bm", "Mon")).toBe("Isn");
  });

  it("translates the Installation screens a Site Supervisor sees into Bahasa Malaysia", () => {
    expect(t("bm", "Site supervisor bookings")).toBe("Tempahan penyelia tapak");
    expect(t("bm", "Collected by supervisor")).toBe("Diambil oleh penyelia");
  });

  it("translates Installation, Stock, Samples and Leftover into Chinese", () => {
    expect(t("zh", "Cancel DO no.")).toBe("取消 DO 编号");
    expect(t("zh", "Pickup forms")).toBe("取货单");
    expect(t("zh", "Collected by supervisor")).toBe("主管已取回");
    expect(t("zh", "Use for project")).toBe("用于项目");
  });

  it("translates the demo's Costing wording into Chinese", () => {
    expect(t("zh", "Save")).toBe("保存");
    expect(t("zh", "Create costing")).toBe("建立 costing");
  });

  it("translates HR and Tools wording into Chinese", () => {
    expect(t("zh", "Staff packages")).toBe("员工待遇");
    expect(t("zh", "Wallpaper calculator")).toBe("壁纸计算器");
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
