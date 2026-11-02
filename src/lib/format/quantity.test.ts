import { expect, test } from "vitest";
import { formatQuantity, roundQuantity } from "./quantity";

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

test("shows quantities with thousands separators and at most 2 decimals", () => {
  expect(formatQuantity(1234.5)).toBe("1,234.5");
  expect(formatQuantity(2.135)).toBe("2.14");
  expect(formatQuantity(0.1 + 0.2)).toBe("0.3");
  expect(formatQuantity(12)).toBe("12");
});
