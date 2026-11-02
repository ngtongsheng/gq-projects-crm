import { expect, test } from "vitest";
import { normaliseMobile } from "./mobile";

test("normalises the usual Malaysian formats to the same digits", () => {
  for (const input of [
    "+60 12-345 6789",
    "60123456789",
    "012-345 6789",
    "0123456789",
    "123456789",
    "0060 12 345 6789",
  ]) {
    expect(normaliseMobile(input)).toBe("60123456789");
  }
});

test("keeps 11-digit 011 numbers", () => {
  expect(normaliseMobile("011-1234 5678")).toBe("601112345678");
});

test("rejects numbers that are too short, too long or not Malaysian", () => {
  expect(normaliseMobile("")).toBeNull();
  expect(normaliseMobile("012-345")).toBeNull();
  expect(normaliseMobile("012-3456 78901")).toBeNull();
  expect(normaliseMobile("+65 9123 4567")).toBeNull();
  expect(normaliseMobile("not a number")).toBeNull();
});
