import { expect, test } from "vitest";
import { isClockTime } from "./clock-time";

test("accepts HH:MM and nothing else", () => {
  expect(isClockTime("00:00")).toBe(true);
  expect(isClockTime("23:59")).toBe(true);
  expect(isClockTime("24:00")).toBe(false);
  expect(isClockTime("9:30")).toBe(false);
  expect(isClockTime("20:00:00")).toBe(false);
  expect(isClockTime("")).toBe(false);
});
