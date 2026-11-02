import { describe, expect, it } from "vitest";
import {
  allowedMoves,
  canMoveStage,
  MOF_STAGES,
  moveWarning,
} from "./mof-stages";

describe("MOF_STAGES", () => {
  it("runs from pending order to closed, then the side stages", () => {
    expect(MOF_STAGES.slice(0, 9)).toEqual([
      "pending_order",
      "ordered",
      "in_production",
      "shipping",
      "arrived_warehouse",
      "pending_delivery",
      "delivered_installing",
      "completed_payment_pending",
      "closed",
    ]);
    expect(MOF_STAGES.slice(9)).toEqual(["on_hold", "cancelled"]);
  });
});

describe("allowedMoves", () => {
  it("lets an open order go to any other stage, holding or cancelling included", () => {
    const moves = allowedMoves("shipping");
    expect(moves).toHaveLength(MOF_STAGES.length - 1);
    expect(moves).not.toContain("shipping");
    expect(moves).toContain("on_hold");
    expect(moves).toContain("cancelled");
  });

  it("lets an order on hold resume at any stage", () => {
    expect(canMoveStage("on_hold", "in_production")).toBe(true);
  });

  it("moves nothing out of closed or cancelled", () => {
    expect(allowedMoves("closed")).toEqual([]);
    expect(allowedMoves("cancelled")).toEqual([]);
  });

  it("refuses a move to the same stage", () => {
    expect(canMoveStage("ordered", "ordered")).toBe(false);
  });
});

describe("moveWarning", () => {
  it("warns when payment was not checked before delivery", () => {
    expect(
      moveWarning("pending_delivery", "delivered_installing", false),
    ).toMatch(/Payment status was not checked/);
    expect(moveWarning("pending_delivery", "closed", false)).not.toBeNull();
  });

  it("stays quiet once payment is checked", () => {
    expect(
      moveWarning("pending_delivery", "delivered_installing", true),
    ).toBeNull();
  });

  it("stays quiet for moves that are not a delivery", () => {
    expect(moveWarning("pending_delivery", "on_hold", false)).toBeNull();
    expect(moveWarning("pending_delivery", "cancelled", false)).toBeNull();
    expect(
      moveWarning("pending_delivery", "arrived_warehouse", false),
    ).toBeNull();
    expect(moveWarning("shipping", "delivered_installing", false)).toBeNull();
  });
});
