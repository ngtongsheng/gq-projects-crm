import { describe, expect, it } from "vitest";
import {
  canRecordLeftover,
  creditNoteState,
  type LeftoverFacts,
  leftoverProblem,
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
