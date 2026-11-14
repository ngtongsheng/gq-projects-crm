import { describe, expect, it } from "vitest";
import { projectValueOf } from "./project-value";

const options = [
  { id: "a", sell: 1000 },
  { id: "b", sell: 2500.5 },
  { id: "c", sell: 1800 },
];

describe("projectValueOf", () => {
  it("uses the option the customer chose, even when it is not the highest", () => {
    expect(
      projectValueOf({ status: "approved", chosenOptionId: "c", options }),
    ).toBe(1800);
  });

  it("uses the highest option when none is chosen", () => {
    expect(
      projectValueOf({ status: "approved", chosenOptionId: null, options }),
    ).toBe(2500.5);
  });

  it.each([
    "draft",
    "submitted",
    "returned",
  ])("offers nothing when %s", (status) => {
    expect(
      projectValueOf({ status, chosenOptionId: null, options }),
    ).toBeNull();
  });

  it("offers nothing when the costing sells nothing", () => {
    expect(
      projectValueOf({
        status: "approved",
        chosenOptionId: null,
        options: [{ id: "a", sell: 0 }],
      }),
    ).toBeNull();
    expect(
      projectValueOf({ status: "approved", chosenOptionId: null, options: [] }),
    ).toBeNull();
  });
});
