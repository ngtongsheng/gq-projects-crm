import { z } from "zod";
import { optionalText, textField } from "@/lib/form/form-fields";
import { parseRm, sumRm } from "@/lib/format/money";

// numeric(12, 2) in travel_claims.
const MAX_AMOUNT = 9_999_999_999.99;

export const AMOUNT_FIELDS = [
  "petrolParkingToll",
  "outstation",
  "hotel",
  "others",
  "overtime",
] as const;

/** An amount in RM; blank means not keyed in (null), as the demo stores "". */
const optionalAmount = z.string().transform((text, ctx) => {
  if (text.trim() === "") return null;
  const amount = parseRm(text);
  if (amount === null || amount < 0 || amount > MAX_AMOUNT) {
    ctx.addIssue({
      code: "custom",
      message: "Enter each amount as RM 0 or more.",
    });
    return z.NEVER;
  }
  return amount;
});

const TravelClaimInput = z
  .object({
    month: z.iso.date(),
    petrolParkingToll: optionalAmount,
    outstation: optionalAmount,
    hotel: optionalAmount,
    others: optionalAmount,
    othersDescription: optionalText(300),
    overtime: optionalAmount,
    remark: optionalText(1000),
  })
  .superRefine((claim, ctx) => {
    if (!(travelClaimTotal(claim) > 0)) {
      ctx.addIssue({ code: "custom", message: "Key in at least one amount" });
    } else if ((claim.others ?? 0) > 0 && claim.othersDescription === null) {
      ctx.addIssue({ code: "custom", message: "Write what was bought" });
    }
  });
export type TravelClaimInput = z.output<typeof TravelClaimInput>;

/** The five keyed amounts added up; empty ones count as nothing (demo tcTot). */
export function travelClaimTotal(
  claim: Partial<Record<(typeof AMOUNT_FIELDS)[number], number | null>>,
): number {
  return sumRm(AMOUNT_FIELDS.map((field) => claim[field] ?? 0));
}

/**
 * Reads the posted claim form. Only Site Supervisors claim overtime, so the field is ignored
 * for everyone else (the database refuses it too).
 */
export function readTravelClaim(formData: FormData, claimsOvertime: boolean) {
  const raw = (key: string) => textField(formData, key);
  return TravelClaimInput.safeParse({
    month: raw("month"),
    petrolParkingToll: raw("petrolParkingToll"),
    outstation: raw("outstation"),
    hotel: raw("hotel"),
    others: raw("others"),
    othersDescription: raw("othersDescription"),
    overtime: claimsOvertime ? raw("overtime") : "",
    remark: raw("remark"),
  });
}
