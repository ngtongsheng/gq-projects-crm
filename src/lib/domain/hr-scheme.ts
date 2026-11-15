/** The performance bonus bands of the Sales Target & Commission Scheme. A reference only: the app does not work bonuses out (loop 16 D2). */
export const BONUS_BANDS: readonly { when: string; reward: string }[] = [
  { when: "Below 100% of annual target", reward: "No bonus" },
  { when: "100% to 124%", reward: "1 month basic salary" },
  { when: "125% and above", reward: "3 months basic salary" },
];

/** The rates the signed scheme states, in percent. */
export const SCHEME_RATES = { own: 3, shared: 1.5 } as const;

/** The scheme's payment rule: commission is payable once this share of the customer's payment is in. */
export const SCHEME_CLAIM_THRESHOLD_PCT = 90;

/** The commission rates saved in settings, in percent (see commission-settings.ts). */
type SettingsRates = { own: number; pass_down: number; company: number };

/** Whether the app's saved commission rates equal what the scheme states. */
export function ratesMatchScheme(rates: SettingsRates): {
  own: boolean;
  shared: boolean;
} {
  return {
    own: rates.own === SCHEME_RATES.own,
    shared:
      rates.pass_down === SCHEME_RATES.shared &&
      rates.company === SCHEME_RATES.shared,
  };
}

/** Target as a multiple of basic, rounded ("12x"); null until a basic is keyed in. */
export function targetOverBasic(
  annualTarget: number,
  basic: number | null,
): number | null {
  return basic ? Math.round(annualTarget / 12 / basic) : null;
}

/** The sales grades in promotion order. Mirrors the check constraint on sales_grades.grade. */
export const SALES_GRADES = [
  "J1",
  "J2",
  "J3",
  "S1",
  "S2",
  "S3",
  "SN1",
  "SN2",
  "SN3",
  "M1",
  "M2",
] as const;
export type SalesGrade = (typeof SALES_GRADES)[number];

export type AppendixStatus = "not_signed" | "signed" | "older_version";

/** Whether a person signed the current scheme: signing an older version means they need the new one. */
export function appendixStatus(
  signedOn: string | null,
  signedVersion: string | null,
  currentVersion: string | null,
): AppendixStatus {
  if (!signedOn) return "not_signed";
  if (signedVersion && currentVersion && signedVersion !== currentVersion) {
    return "older_version";
  }
  return "signed";
}
