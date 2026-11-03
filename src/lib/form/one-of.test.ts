import { expect, test } from "vitest";
import { isOneOf } from "./one-of";

test("accepts only a listed option", () => {
  const units = ["roll", "box"] as const;
  expect(isOneOf(units, "box")).toBe(true);
  expect(isOneOf(units, "pallet")).toBe(false);
  expect(isOneOf(units, "")).toBe(false);
});
