import { z } from "zod";
import { DEFAULT_PAYMENT_THRESHOLD_PCT } from "./collection";

const percent = (label: string) =>
  z
    .number({ error: `Enter ${label} as a number.` })
    .min(0, `${label} can't be below 0%.`)
    .max(100, `${label} can't be above 100%.`);

const days = (label: string) =>
  z
    .number({ error: `Enter ${label} in days.` })
    .int(`Enter ${label} in whole days.`)
    .min(0, `${label} can't be below 0 days.`)
    .max(3650, `${label} can't be over 3,650 days.`);

/** The rules kept in app_settings under `commission`. The claim threshold lives in `payment_threshold_pct`. */
const commissionRules = z.object({
  baseRatePct: z.object({
    own: percent("The own effort rate"),
    pass_down: percent("The pass-down rate"),
    company: percent("The company account rate"),
  }),
  noCommissionBelowPct: percent("The no-commission margin"),
  lowMarginBelowPct: percent("The low margin"),
  lowMarginRatePct: z.object({
    own: percent("The low-margin own account rate"),
    other: percent("The low-margin pass-down / company rate"),
  }),
  highMarginAbovePct: percent("The high margin"),
  highMarginBonusPct: percent("The high-margin extra"),
  firstLateCut: z.object({
    afterDays: days("The first late cut"),
    cutPct: percent("The first late cut"),
  }),
  secondLateCut: z.object({
    afterDays: days("The second late cut"),
    cutPct: percent("The second late cut"),
  }),
  /** The first salesperson's share when two are on an MOF; the second gets the rest. */
  splitSharePct: percent("The split share"),
  /** For a person set to "Flat 1% on pass-down sales": their rate on every MOF they are on or passed down. */
  flatPassDownRatePct: percent("The flat pass-down rate"),
});

export const CommissionSettings = commissionRules
  .extend({
    claimThresholdPct: z
      .number({ error: "Enter the claim threshold as a number." })
      .min(1, "The claim threshold must be at least 1%.")
      .max(100, "The claim threshold can't be above 100%."),
  })
  .refine((s) => s.noCommissionBelowPct <= s.lowMarginBelowPct, {
    message: "The no-commission level must be lower than the low-margin level.",
  })
  .refine((s) => s.lowMarginBelowPct <= s.highMarginAbovePct, {
    message: "The high-margin level must be above the low-margin level.",
  })
  .refine((s) => s.secondLateCut.afterDays > s.firstLateCut.afterDays, {
    message: "The second cut must start after the first.",
  });
export type CommissionSettings = z.infer<typeof CommissionSettings>;

/** The prototype's rules, used until the MD saves her own. */
export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  baseRatePct: { own: 3, pass_down: 1.5, company: 1.5 },
  noCommissionBelowPct: 20,
  lowMarginBelowPct: 30,
  lowMarginRatePct: { own: 1.5, other: 1 },
  highMarginAbovePct: 45,
  highMarginBonusPct: 1,
  firstLateCut: { afterDays: 90, cutPct: 25 },
  secondLateCut: { afterDays: 120, cutPct: 50 },
  splitSharePct: 50,
  flatPassDownRatePct: 1,
  claimThresholdPct: DEFAULT_PAYMENT_THRESHOLD_PCT,
};

export const COMMISSION_SETTINGS_KEY = "commission";
export const CLAIM_THRESHOLD_KEY = "payment_threshold_pct";

/**
 * Settings from the two stored app_settings values. Anything missing falls back to the defaults;
 * `valid` is false when a stored value was there but unreadable, so the caller can log it.
 */
export function settingsFromStored(stored: {
  rules: unknown;
  claimThresholdPct: unknown;
}): { settings: CommissionSettings; valid: boolean } {
  const rules =
    stored.rules == null
      ? { success: true as const, data: DEFAULT_COMMISSION_SETTINGS }
      : commissionRules.safeParse(stored.rules);
  const threshold =
    stored.claimThresholdPct == null
      ? {
          success: true as const,
          data: DEFAULT_COMMISSION_SETTINGS.claimThresholdPct,
        }
      : CommissionSettings.shape.claimThresholdPct.safeParse(
          stored.claimThresholdPct,
        );
  const combined = CommissionSettings.safeParse({
    ...(rules.success ? rules.data : DEFAULT_COMMISSION_SETTINGS),
    claimThresholdPct: threshold.success
      ? threshold.data
      : DEFAULT_COMMISSION_SETTINGS.claimThresholdPct,
  });
  return combined.success && rules.success && threshold.success
    ? { settings: combined.data, valid: true }
    : { settings: DEFAULT_COMMISSION_SETTINGS, valid: false };
}

/** The app_settings rows that store `settings`. */
export function storedRows(
  settings: CommissionSettings,
): { key: string; value: unknown }[] {
  const { claimThresholdPct, ...rules } = settings;
  return [
    { key: COMMISSION_SETTINGS_KEY, value: rules },
    { key: CLAIM_THRESHOLD_KEY, value: claimThresholdPct },
  ];
}
