import { expect, test } from "vitest";
import { roundQuantity } from "./quantity";

test("rounds to 2 decimals, halves up", () => {
  expect(roundQuantity(2.135)).toBe(2.14);
  expect(roundQuantity(2.175)).toBe(2.18);
  expect(roundQuantity(1.005)).toBe(1.01);
  expect(roundQuantity(2.134)).toBe(2.13);
});

test("drops float noise from sums", () => {
  expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
  expect(roundQuantity(10 - 8.9)).toBe(1.1);
});
