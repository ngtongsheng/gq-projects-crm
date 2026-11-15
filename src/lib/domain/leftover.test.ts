import { describe, expect, it } from "vitest";
import {
  canRecordLeftover,
  creditNoteState,
  guessLeftoverKeepReason,
  type LeftoverFacts,
  leftoverAllocationProblem,
  leftoverAvailable,
  leftoverProblem,
  leftoverTransportState,
  suggestLeftoverDestination,
} from "./leftover";

const facts = (over: Partial<LeftoverFacts> = {}): LeftoverFacts => ({
  destination: "supplier",
  status: "pending_pickup",
  creditNoteNo: null,
  creditNoteAmount: null,
  ...over,
});

describe("leftoverProblem", () => {
  it("accepts a fresh supplier return and a returned one with its credit note", () => {
    expect(leftoverProblem(facts())).toBeNull();
    expect(
      leftoverProblem(
        facts({
          status: "returned_to_supplier",
          creditNoteNo: "CN-1",
          creditNoteAmount: 120,
        }),
      ),
    ).toBeNull();
  });

  it("lets an item be marked returned before the credit note arrives", () => {
    expect(
      leftoverProblem(facts({ status: "returned_to_supplier" })),
    ).toBeNull();
  });

  it("refuses returned to supplier when GQ keeps the item", () => {
    expect(
      leftoverProblem(
        facts({ destination: "gq", status: "returned_to_supplier" }),
      ),
    ).not.toBeNull();
  });

  it("refuses at Best Link when the item goes back to the supplier", () => {
    expect(leftoverProblem(facts({ status: "at_best_link" }))).not.toBeNull();
    expect(
      leftoverProblem(facts({ destination: "gq", status: "at_best_link" })),
    ).toBeNull();
  });

  it("refuses a credit note on stock GQ keeps", () => {
    expect(
      leftoverProblem(facts({ destination: "gq", creditNoteNo: "CN-1" })),
    ).not.toBeNull();
  });

  it("needs the credit note number when an amount is given", () => {
    expect(leftoverProblem(facts({ creditNoteAmount: 50 }))).not.toBeNull();
  });
});

describe("creditNoteState", () => {
  it("is pending once returned without a credit note", () => {
    expect(creditNoteState(facts({ status: "returned_to_supplier" }))).toEqual({
      kind: "pending",
    });
  });

  it("shows the number and amount once keyed in", () => {
    expect(
      creditNoteState(
        facts({
          status: "returned_to_supplier",
          creditNoteNo: "CN-1",
          creditNoteAmount: 1234.5,
        }),
      ),
    ).toEqual({ kind: "received", label: "CN CN-1 · RM 1,234.50" });
  });

  it("is nothing before pickup or for stock GQ keeps", () => {
    expect(creditNoteState(facts())).toBeNull();
    expect(creditNoteState(facts({ destination: "gq" }))).toBeNull();
  });
});

describe("suggestLeftoverDestination", () => {
  it("keeps rolls, custom and indent items; sends the rest back", () => {
    expect(suggestLeftoverDestination("Carpet roll, Navy", "m2")).toBe("gq");
    expect(suggestLeftoverDestination("Custom logo mat", "pcs")).toBe("gq");
    expect(suggestLeftoverDestination("Carpet tile 50x50, Grey", "box")).toBe(
      "supplier",
    );
    expect(suggestLeftoverDestination("Adhesive", "roll")).toBe("gq");
  });

  it("matches the demo's suggestDest for the demo's items", () => {
    expect(
      suggestLeftoverDestination("Carpet tile 50x50 cm, Grey", "box"),
    ).toBe("supplier");
    expect(suggestLeftoverDestination("Vinyl plank offcuts", "m2")).toBe("gq");
    expect(suggestLeftoverDestination("Indent tiles from CHINA", "box")).toBe(
      "gq",
    );
  });
});

describe("guessLeftoverKeepReason", () => {
  it("matches the demo's keepWhyGuess", () => {
    expect(guessLeftoverKeepReason("Indent from China, Beige")).toBe(
      "indent_from_china",
    );
    expect(guessLeftoverKeepReason("Custom made rug")).toBe("custom_made");
    expect(guessLeftoverKeepReason("Carpet roll, Navy")).toBe("custom_made");
    expect(guessLeftoverKeepReason("Vinyl offcut")).toBe("custom_made");
    expect(guessLeftoverKeepReason("Carpet tile 50x50")).toBe("gq_own_stock");
  });

  it("puts China before custom, as the demo does", () => {
    expect(guessLeftoverKeepReason("Custom roll from China")).toBe(
      "indent_from_china",
    );
  });
});

describe("leftoverAvailable", () => {
  it("takes the uses for other projects off the quantity", () => {
    expect(leftoverAvailable(20, [])).toBe(20);
    expect(leftoverAvailable(20, [{ qty: 6 }, { qty: 4.5 }])).toBe(9.5);
  });

  it("is zero once sold out and never negative", () => {
    expect(leftoverAvailable(10, [{ qty: 10 }])).toBe(0);
    expect(leftoverAvailable(10, [{ qty: 12 }])).toBe(0);
  });

  it("does not drift on decimal quantities", () => {
    expect(leftoverAvailable(0.3, [{ qty: 0.1 }, { qty: 0.1 }])).toBe(0.1);
  });
});

describe("leftoverAllocationProblem", () => {
  it("accepts up to what is left", () => {
    expect(leftoverAllocationProblem(6, 6, "box")).toBeNull();
  });

  it("refuses more than is left, and no quantity", () => {
    expect(leftoverAllocationProblem(7, 6, "m2")).toBe(
      "Only 6 m² left at Best Link.",
    );
    expect(leftoverAllocationProblem(0, 6, "box")).toBe("Enter the quantity.");
  });
});

describe("leftoverTransportState", () => {
  it("is to arrange until purchasing names the transport", () => {
    expect(
      leftoverTransportState({
        status: "collected_by_supervisor",
        returnMethod: "transport",
        transportBy: null,
      }),
    ).toBe("to_arrange");
    expect(
      leftoverTransportState({
        status: "pending_pickup",
        returnMethod: "transport",
        transportBy: "Lalamove",
      }),
    ).toBe("arranged");
  });

  it("is nothing for other return methods or once the item has arrived", () => {
    expect(
      leftoverTransportState({
        status: "pending_pickup",
        returnMethod: "installer",
        transportBy: null,
      }),
    ).toBeNull();
    expect(
      leftoverTransportState({
        status: "at_best_link",
        returnMethod: "transport",
        transportBy: null,
      }),
    ).toBeNull();
  });
});

describe("canRecordLeftover", () => {
  it("allows site supervisors and stock arrangers only", () => {
    const person = (
      jobRole: Parameters<typeof canRecordLeftover>[0]["jobRole"],
      arrangesStock = false,
    ) => canRecordLeftover({ jobRole, arrangesStock });
    expect(person("site")).toBe(true);
    expect(person("support")).toBe(true);
    expect(person("md")).toBe(true);
    expect(person("sales")).toBe(false);
    expect(person("sales", true)).toBe(true);
    expect(person("accounts")).toBe(false);
  });
});
