import { describe, expect, it } from "vitest";
import {
  availableQty,
  canExtendHold,
  canMoveReservation,
  extendedUntil,
  holdState,
  holdUntil,
  overHeldQty,
  type ReservationStatus,
  supplierMailto,
} from "./reservation";

const line = (status: ReservationStatus, qty: number) => ({ status, qty });

describe("availableQty", () => {
  it("takes live holds and delivered lines off the stock on hand", () => {
    expect(
      availableQty(100, [
        line("requested", 10),
        line("reserved", 20),
        line("po_issued", 5),
        line("delivered", 15),
      ]),
    ).toBe(50);
  });

  it("gives back released and cancelled lines", () => {
    expect(
      availableQty(100, [line("released", 30), line("cancelled", 40)]),
    ).toBe(100);
  });

  it("does not drift on decimal quantities", () => {
    expect(
      availableQty(1, [line("reserved", 0.1), line("reserved", 0.2)]),
    ).toBe(0.7);
  });

  it("never goes below zero", () => {
    expect(availableQty(10, [line("reserved", 25)])).toBe(0);
  });
});

describe("holdState", () => {
  const today = "2026-11-10";

  it("shows a request as waiting for stock to confirm", () => {
    expect(
      holdState({ status: "requested", expiresOn: null }, today, 3),
    ).toEqual({ kind: "waiting" });
  });

  it("is quiet while the end date is further than the warning", () => {
    expect(
      holdState({ status: "reserved", expiresOn: "2026-11-14" }, today, 3),
    ).toBeNull();
  });

  it("warns from the warning day up to and including the last day", () => {
    expect(
      holdState({ status: "reserved", expiresOn: "2026-11-13" }, today, 3),
    ).toEqual({ kind: "expiring", daysLeft: 3 });
    expect(
      holdState({ status: "po_issued", expiresOn: "2026-11-10" }, today, 3),
    ).toEqual({ kind: "expiring", daysLeft: 0 });
  });

  it("is expired the day after the end date", () => {
    expect(
      holdState({ status: "reserved", expiresOn: "2026-11-09" }, today, 3),
    ).toEqual({ kind: "expired", daysAgo: 1 });
  });

  it("does not warn when the warning is zero days, until the last day", () => {
    expect(
      holdState({ status: "reserved", expiresOn: "2026-11-11" }, today, 0),
    ).toBeNull();
    expect(
      holdState({ status: "reserved", expiresOn: "2026-11-10" }, today, 0),
    ).toEqual({ kind: "expiring", daysLeft: 0 });
  });

  it("ignores lines that no longer hold stock", () => {
    for (const status of ["delivered", "released", "cancelled"] as const) {
      expect(
        holdState({ status, expiresOn: "2026-11-01" }, today, 3),
      ).toBeNull();
    }
  });
});

describe("hold dates", () => {
  it("runs the hold days from the day it was taken", () => {
    expect(holdUntil("2026-11-02", 14)).toBe("2026-11-16");
    expect(holdUntil("2026-12-25", 14)).toBe("2027-01-08");
  });

  it("extends from the current end while the hold is still running", () => {
    expect(extendedUntil("2026-11-12", "2026-11-10", 14)).toBe("2026-11-26");
  });

  it("restarts from today once the hold has lapsed", () => {
    expect(extendedUntil("2026-11-01", "2026-11-10", 14)).toBe("2026-11-24");
    expect(extendedUntil("2026-11-10", "2026-11-10", 14)).toBe("2026-11-24");
  });
});

describe("status moves", () => {
  it("allows confirming a request, then the path to delivery", () => {
    expect(canMoveReservation("requested", "reserved")).toBe(true);
    expect(canMoveReservation("reserved", "po_issued")).toBe(true);
    expect(canMoveReservation("po_issued", "delivered")).toBe(true);
    expect(canMoveReservation("reserved", "released")).toBe(true);
  });

  it("does not skip confirmation or reopen a finished line", () => {
    expect(canMoveReservation("requested", "delivered")).toBe(false);
    expect(canMoveReservation("released", "reserved")).toBe(false);
    expect(canMoveReservation("delivered", "released")).toBe(false);
    expect(canMoveReservation("reserved", "cancelled")).toBe(false);
  });

  it("extends only confirmed holds", () => {
    expect(canExtendHold("reserved")).toBe(true);
    expect(canExtendHold("po_issued")).toBe(true);
    expect(canExtendHold("requested")).toBe(false);
    expect(canExtendHold("released")).toBe(false);
  });
});

describe("supplierMailto", () => {
  const base = {
    sku: "FTP-227-702",
    collection: "Forge",
    qty: 40,
    unit: "box",
    projectName: "Level 3 fit-out",
    expiresOn: "2026-11-16",
  } as const;

  it("asks the supplier to hold until the end date", () => {
    const link = supplierMailto({ ...base, status: "reserved" });
    expect(link).toMatch(/^mailto:\?subject=/);
    const body = decodeURIComponent(link?.split("&body=")[1] ?? "");
    expect(body).toContain("40 box of FTP-227-702 (Forge)");
    expect(body).toContain("until 16 Nov 2026");
  });

  it("asks the supplier to release a released line", () => {
    const link = supplierMailto({ ...base, status: "released" });
    expect(decodeURIComponent(link ?? "")).toContain("Release FTP-227-702");
  });

  it("has nothing to send for a request or a finished line", () => {
    for (const status of ["requested", "delivered", "cancelled"] as const) {
      expect(supplierMailto({ ...base, status })).toBeNull();
    }
  });
});

describe("overHeldQty", () => {
  it("is the shortfall when on hand is below what is taken", () => {
    expect(overHeldQty(10, [line("reserved", 25)])).toBe(15);
  });

  it("is 0 when on hand equals what is taken", () => {
    expect(overHeldQty(25, [line("reserved", 25)])).toBe(0);
  });

  it("is 0 when on hand is above what is taken", () => {
    expect(overHeldQty(30, [line("reserved", 25), line("released", 9)])).toBe(
      0,
    );
  });
});
