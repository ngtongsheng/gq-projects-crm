import { describe, expect, it } from "vitest";
import {
  hasLiveSupplierPo,
  isSupplierPoOverdue,
  type SupplierPoStatus,
  supplierPoEta,
  supplierPoNumber,
  supplierPoReason,
} from "./supplier-po";

describe("supplierPoNumber", () => {
  it("puts the Zoho running number after the MOF number", () => {
    expect(supplierPoNumber("1590", "2210")).toBe("15902210");
  });
});

describe("supplierPoEta", () => {
  it("adds the lead time to the PO date", () => {
    expect(supplierPoEta("2026-11-02", 21)).toBe("2026-11-23");
  });

  it("crosses month and year ends", () => {
    expect(supplierPoEta("2026-12-20", 15)).toBe("2027-01-04");
  });

  it("is the PO date when there is no lead time", () => {
    expect(supplierPoEta("2026-11-02", 0)).toBe("2026-11-02");
  });
});

describe("isSupplierPoOverdue", () => {
  const po = (status: SupplierPoStatus) => ({
    poDate: "2026-10-01",
    leadTimeDays: 21,
    status,
  });

  it("is overdue the day after the ETA when goods have not arrived", () => {
    expect(isSupplierPoOverdue(po("in_production"), "2026-10-23")).toBe(true);
  });

  it("is not overdue on the ETA itself", () => {
    expect(isSupplierPoOverdue(po("shipping"), "2026-10-22")).toBe(false);
  });

  it("is not overdue once the goods are in KL, delivered or cancelled", () => {
    for (const status of [
      "at_kl_supplier_warehouse",
      "at_best_link_warehouse",
      "delivered",
      "cancelled",
    ] as const) {
      expect(isSupplierPoOverdue(po(status), "2027-01-01")).toBe(false);
    }
  });
});

describe("hasLiveSupplierPo", () => {
  it("is false with no PO or only cancelled ones", () => {
    expect(hasLiveSupplierPo([])).toBe(false);
    expect(hasLiveSupplierPo([{ status: "cancelled" }])).toBe(false);
  });

  it("is true with any PO that is not cancelled", () => {
    expect(
      hasLiveSupplierPo([{ status: "cancelled" }, { status: "delivered" }]),
    ).toBe(true);
  });
});

describe("supplierPoReason", () => {
  it("names an indent or custom made line", () => {
    expect(supplierPoReason([{ stockType: "indent" }], 10)).toMatch(/indent/);
  });

  it("names a big order when every line is ex stock", () => {
    expect(supplierPoReason([{ stockType: "stock" }], 1000)).toMatch(
      /big order \(1,000 m² or more\)/,
    );
  });

  it("is null for a small ex stock order", () => {
    expect(supplierPoReason([{ stockType: "stock" }], 999)).toBeNull();
  });
});
