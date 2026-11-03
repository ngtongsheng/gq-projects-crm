import { describe, expect, it } from "vitest";
import { heldQty } from "./reservation-filters";
import type { Reservation } from "./stock-data";

const line = (overrides: Partial<Reservation>): Reservation => ({
  id: "line",
  itemId: "item-1",
  sku: "SKU",
  supplier: "Supplier",
  collection: "",
  unit: "box",
  qty: 1,
  projectId: "project",
  projectName: "Project",
  companyName: "Company",
  mofNo: null,
  reservedBy: "person",
  status: "reserved",
  reservedAt: null,
  expiresOn: null,
  note: "",
  createdAt: "2026-11-02T00:00:00Z",
  ...overrides,
});

describe("heldQty", () => {
  it("adds only live holds on the item", () => {
    const lines = [
      line({ qty: 2 }),
      line({ qty: 3, status: "requested" }),
      line({ qty: 5, status: "released" }),
      line({ qty: 7, itemId: "item-2" }),
    ];
    expect(heldQty("item-1", lines)).toBe(5);
  });

  it("does not show float noise from adding decimals", () => {
    const lines = [line({ qty: 0.1 }), line({ qty: 0.2 })];
    expect(heldQty("item-1", lines)).toBe(0.3);
  });
});
