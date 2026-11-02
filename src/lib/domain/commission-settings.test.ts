import { describe, expect, it } from "vitest";
import {
  CommissionSettings,
  DEFAULT_COMMISSION_SETTINGS,
  settingsFromStored,
  storedRows,
} from "./commission-settings";

describe("CommissionSettings", () => {
  it("accepts the defaults", () => {
    expect(
      CommissionSettings.safeParse(DEFAULT_COMMISSION_SETTINGS).success,
    ).toBe(true);
  });

  it.each([
    [
      { noCommissionBelowPct: 35 },
      "The no-commission level must be lower than the low-margin level.",
    ],
    [
      { highMarginAbovePct: 25 },
      "The high-margin level must be above the low-margin level.",
    ],
    [
      { secondLateCut: { afterDays: 90, cutPct: 50 } },
      "The second cut must start after the first.",
    ],
    [{ claimThresholdPct: 0 }, "The claim threshold must be at least 1%."],
    [{ splitSharePct: 101 }, "The split share can't be above 100%."],
  ])("rejects %o", (change, message) => {
    const result = CommissionSettings.safeParse({
      ...DEFAULT_COMMISSION_SETTINGS,
      ...change,
    });
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("settingsFromStored", () => {
  it("uses the defaults when nothing is stored", () => {
    expect(
      settingsFromStored({ rules: null, claimThresholdPct: null }),
    ).toEqual({ settings: DEFAULT_COMMISSION_SETTINGS, valid: true });
  });

  it("round-trips what storedRows writes", () => {
    const saved = {
      ...DEFAULT_COMMISSION_SETTINGS,
      lowMarginBelowPct: 32.5,
      claimThresholdPct: 95,
    };
    const [rules, threshold] = storedRows(saved);
    expect(rules?.key).toBe("commission");
    expect(threshold).toEqual({ key: "payment_threshold_pct", value: 95 });
    expect(
      settingsFromStored({
        rules: rules?.value,
        claimThresholdPct: threshold?.value,
      }),
    ).toEqual({ settings: saved, valid: true });
  });

  it("falls back to the defaults and flags an unreadable value", () => {
    expect(
      settingsFromStored({ rules: { baseRatePct: 3 }, claimThresholdPct: 90 }),
    ).toEqual({ settings: DEFAULT_COMMISSION_SETTINGS, valid: false });
  });
});
