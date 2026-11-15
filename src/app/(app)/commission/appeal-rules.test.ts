import { describe, expect, it } from "vitest";
import { appealKey, canSendAppeal } from "./appeal-rules";

const base = {
  linePersonId: "a",
  myId: "a",
  lateCut: 120,
  appealStatus: undefined,
} as const;

describe("canSendAppeal", () => {
  it("lets a salesperson appeal their own late cut", () => {
    expect(canSendAppeal(base)).toBe(true);
  });

  it("does not offer an appeal on someone else's line", () => {
    expect(canSendAppeal({ ...base, myId: "b" })).toBe(false);
  });

  it("does not offer an appeal when nothing was cut", () => {
    expect(canSendAppeal({ ...base, lateCut: 0 })).toBe(false);
  });

  it("does not offer a second appeal while one is waiting or approved", () => {
    expect(canSendAppeal({ ...base, appealStatus: "pending" })).toBe(false);
    expect(canSendAppeal({ ...base, appealStatus: "approved" })).toBe(false);
  });

  it("offers another appeal after a rejection", () => {
    expect(canSendAppeal({ ...base, appealStatus: "rejected" })).toBe(true);
  });
});

describe("appealKey", () => {
  it("is the same for the same order and person", () => {
    expect(appealKey("m1", "p1")).toBe(appealKey("m1", "p1"));
    expect(appealKey("m1", "p1")).not.toBe(appealKey("m1", "p2"));
  });
});
