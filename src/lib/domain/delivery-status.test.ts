import { describe, expect, it } from "vitest";
import {
  deliveryOrderNumber,
  deliveryStatus,
  isDoRunningNo,
  missingDeliveryChecks,
} from "./delivery-status";

const delivery = (
  status: "scheduled" | "in_progress" | "done" | "postponed",
  isFinal = false,
) => ({ status, isFinal });

describe("deliveryStatus", () => {
  it("is not delivered when there are no deliveries", () => {
    expect(deliveryStatus([]).state).toBe("not_delivered");
  });

  it("is scheduled while no delivery is done", () => {
    const result = deliveryStatus([
      delivery("scheduled"),
      delivery("in_progress"),
    ]);
    expect(result).toMatchObject({
      state: "scheduled",
      label: "Delivery scheduled",
    });
  });

  it("ignores postponed deliveries", () => {
    expect(deliveryStatus([delivery("postponed")]).state).toBe("not_delivered");
    expect(
      deliveryStatus([delivery("postponed", true), delivery("scheduled")])
        .state,
    ).toBe("scheduled");
  });

  it("is partial once a delivery is done without being the final one", () => {
    const result = deliveryStatus([
      delivery("done"),
      delivery("scheduled", true),
    ]);
    expect(result).toMatchObject({
      state: "partial",
      label: "Partially delivered (1 DO)",
      doneCount: 1,
    });
  });

  it("counts every done delivery in the partial label", () => {
    expect(deliveryStatus([delivery("done"), delivery("done")]).label).toBe(
      "Partially delivered (2 DOs)",
    );
  });

  it("is fully delivered only when a final delivery is done", () => {
    expect(
      deliveryStatus([delivery("done"), delivery("done", true)]),
    ).toMatchObject({
      state: "full",
      label: "Fully delivered",
      doneCount: 2,
    });
    expect(deliveryStatus([delivery("in_progress", true)]).state).toBe(
      "scheduled",
    );
  });
});

describe("deliveryOrderNumber", () => {
  it("puts the running number after the MOF number", () => {
    expect(deliveryOrderNumber("MOF2611", "5563")).toBe("MOF26115563");
  });

  it("has no number until Zoho issues the running number", () => {
    expect(deliveryOrderNumber("MOF2611", null)).toBeNull();
    expect(deliveryOrderNumber("MOF2611", "")).toBeNull();
  });
});

describe("isDoRunningNo", () => {
  it("accepts exactly four digits", () => {
    expect(isDoRunningNo("5563")).toBe(true);
    expect(isDoRunningNo("556")).toBe(false);
    expect(isDoRunningNo("55633")).toBe(false);
    expect(isDoRunningNo("MOF5")).toBe(false);
  });
});

describe("missingDeliveryChecks", () => {
  it("lists what is not yet ticked on the MOF", () => {
    expect(
      missingDeliveryChecks({ paymentChecked: false, dosPreApproved: false }),
    ).toEqual([
      "payment status not checked",
      "DO not pre-approved by management",
    ]);
    expect(
      missingDeliveryChecks({ paymentChecked: true, dosPreApproved: true }),
    ).toEqual([]);
  });
});
