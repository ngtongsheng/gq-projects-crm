import { expect, test } from "vitest";
import { formatRm, parseRm, sumRm } from "./money";

test("formats RM with thousands separators and two decimals", () => {
  expect(formatRm(12345)).toBe("RM 12,345.00");
  expect(formatRm(0.5)).toBe("RM 0.50");
  expect(formatRm(1234567.891)).toBe("RM 1,234,567.89");
});

test("formats negative amounts with the sign in front", () => {
  expect(formatRm(-1500.5)).toBe("-RM 1,500.50");
});

test("parses form input with commas, RM prefix and spaces", () => {
  expect(parseRm("12,345.6")).toBe(12345.6);
  expect(parseRm(" RM 1,000 ")).toBe(1000);
  expect(parseRm("rm2.50")).toBe(2.5);
  expect(parseRm("-20")).toBe(-20);
});

test("rounds parsed input to cents", () => {
  expect(parseRm("1.005")).toBe(1.01);
});

test("rejects text that is not an amount", () => {
  for (const text of ["", "abc", "1.2.3", "RM", "12 000", "--5"]) {
    expect(parseRm(text)).toBeNull();
  }
});

test("sums without float drift", () => {
  expect(0.1 + 0.2).not.toBe(0.3);
  expect(sumRm([0.1, 0.2])).toBe(0.3);
  expect(sumRm([19.99, 19.99, 19.99])).toBe(59.97);
  expect(sumRm([])).toBe(0);
});
