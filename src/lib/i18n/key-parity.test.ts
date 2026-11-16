import { describe, expect, it } from "vitest";
import { bm } from "./bm";
import {
  KNOWN_MISSING_IN_BM,
  KNOWN_MISSING_IN_ZH,
} from "./key-parity-known-gaps";
import { zh } from "./zh";

const missingFrom = (source: object, target: object) =>
  Object.keys(source)
    .filter((key) => !(key in target))
    .sort();

describe("zh and bm key parity", () => {
  it("has no new phrase translated in Chinese but not Malay", () => {
    expect(missingFrom(zh, bm)).toEqual(KNOWN_MISSING_IN_BM);
  });

  it("has no new phrase translated in Malay but not Chinese", () => {
    expect(missingFrom(bm, zh)).toEqual(KNOWN_MISSING_IN_ZH);
  });
});
