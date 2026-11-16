import { describe, expect, it } from "vitest";
import { describeMove } from "./sample-history";
import type { SampleMoveRow } from "./samples-data";

const move = (fields: Partial<SampleMoveRow>): SampleMoveRow => ({
  id: "m1",
  kind: "out",
  qty: 1,
  backOn: null,
  movedOn: "2026-11-13",
  qtyBefore: 3,
  takenBy: "p1",
  forWhom: "",
  pickupNo: null,
  createdAt: "2026-11-13T02:00:00Z",
  ...fields,
});
const people = new Map([["p1", "Vanisha"]]);

describe("describeMove", () => {
  it("says who took it out, for whom, on which form, and when it came back", () => {
    expect(
      describeMove(
        move({ forWhom: "SLA Architects", pickupNo: 3, backOn: "2026-11-15" }),
        "pc",
        people,
      ).text,
    ).toBe(
      "1 pc taken out by Vanisha for SLA Architects · SR-0003 · back 15 Nov 2026",
    );
  });

  it("reads the first count as Added and later ones as a change", () => {
    expect(
      describeMove(
        move({ kind: "adjust", qty: 4, qtyBefore: 0 }),
        "box",
        people,
      ).text,
    ).toBe("Added 4 boxes");
    expect(
      describeMove(
        move({ kind: "adjust", qty: 5, qtyBefore: 4 }),
        "box",
        people,
      ).text,
    ).toBe("Qty 4 → 5 boxes");
  });

  it("says the client keeps a sample that is gone for good", () => {
    expect(
      describeMove(move({ kind: "kept", forWhom: "Alan" }), "pc", people).text,
    ).toBe("1 pc given to Alan to keep · by Vanisha");
  });
});
