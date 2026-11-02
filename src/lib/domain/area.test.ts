import { expect, test } from "vitest";
import { m2ToSqft, sqftToM2 } from "./area";

test("converts square feet to square metres, 2 decimals", () => {
  expect(sqftToM2(10.764)).toBe(1);
  expect(sqftToM2(1000)).toBe(92.9);
  expect(sqftToM2(0)).toBe(0);
});

test("converts square metres to square feet, 2 decimals", () => {
  expect(m2ToSqft(1)).toBe(10.76);
  expect(m2ToSqft(92.9)).toBe(999.98);
});
