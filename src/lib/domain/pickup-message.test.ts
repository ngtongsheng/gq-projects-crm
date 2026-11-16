import { describe, expect, it } from "vitest";
import {
  type PickupMessage,
  pickupWhatsAppText,
  whatsAppLink,
} from "./pickup-message";

const form: PickupMessage = {
  runningNo: 3,
  appointmentOn: "20 Nov 2026",
  method: "self_pickup",
  personInCharge: "Wai Mun",
  contact: "012-3723925",
  driverContact: null,
  vehicleNo: null,
  lines: [
    {
      productName: "XCH-03",
      spec: "50×50cm",
      qty: 2,
      unit: "box",
      remarks: null,
    },
    {
      productName: "37,PRI-04",
      spec: null,
      qty: 1,
      unit: "pc",
      remarks: "for SLA",
    },
  ],
};

describe("pickupWhatsAppText", () => {
  it("lists the form, method, contact and each item in Chinese", () => {
    expect(pickupWhatsAppText(form)).toBe(
      [
        "您好 Best Link，GQ Projects 提货 SR-0003",
        "提货日期：20 Nov 2026",
        "提货方式：自取 Self pick-up",
        "联系人：Wai Mun 012-3723925",
        "",
        "货品：",
        "1. XCH-03 50×50cm × 2箱",
        "2. 37,PRI-04 × 1片（for SLA）",
        "",
        "附上签收单 PDF，请安排。谢谢！",
        "(Sample pickup SR-0003 – signature receipt PDF attached. Thank you.)",
      ].join("\n"),
    );
  });

  it("adds the driver and vehicle only when known", () => {
    const text = pickupWhatsAppText({
      ...form,
      driverContact: "011-111",
      vehicleNo: "WXY 1234",
    });
    expect(text).toContain("司机：011-111\n车牌号：WXY 1234");
  });
});

describe("whatsAppLink", () => {
  it("encodes the text and uses the number when there is one", () => {
    expect(whatsAppLink("60123723925", "a b")).toBe(
      "https://wa.me/60123723925?text=a%20b",
    );
  });

  it("leaves the number out when none is set", () => {
    expect(whatsAppLink(null, "hi")).toBe("https://wa.me/?text=hi");
  });
});
