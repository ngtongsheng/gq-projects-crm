"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { canManageClaims } from "@/lib/domain/claim-eligibility";
import { optionalText, textField } from "@/lib/form/form-fields";
import { todayMyt } from "@/lib/format/date";
import { toCents } from "@/lib/format/money";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { optionalAmount, travelClaimTotal } from "./travel-claim-input";

export type TravelClaimReviewResult = { error: string | null };

const NOT_ALLOWED =
  "Only HR & Accounts or the MD checks a claim, and never their own.";
const NOT_FOUND = "Could not find that claim. Reload the page.";
const MOVED_ON =
  "This claim is no longer waiting to be checked. Reload the page.";
const NO_REPORT = "Monthly report not submitted yet";
const TRY_AGAIN = "Could not save. Try again.";

const CheckInput = z.object({
  finalAmount: optionalAmount,
  finalNote: optionalText(500),
  verifiedWithVicky: z.boolean(),
});

const claimRow = z.object({
  profile_id: z.uuid(),
  status: z.enum(["draft", "submitted", "released"]),
  petrol_parking_toll: z.coerce.number().nullable(),
  outstation: z.coerce.number().nullable(),
  hotel: z.coerce.number().nullable(),
  others: z.coerce.number().nullable(),
  overtime: z.coerce.number().nullable(),
  verified_with_vicky_on: z.iso.date().nullable(),
});

/**
 * What the check sheet changes on a submitted claim: the final amount (kept only when it differs
 * from the total), Jany's note and the "verified with Vicky" date, plus where the claim goes
 * next. Done in one update so the claim never ends up half-saved. The database holds the line on
 * who may do it and on the monthly report (guard_travel_claim_write).
 */
async function checkClaim(
  claimId: string,
  formData: FormData,
  next: "submitted" | "draft" | "released",
): Promise<TravelClaimReviewResult> {
  const me = await requirePage("claims");
  if (!canManageClaims(me.jobRole)) return { error: NOT_ALLOWED };
  const id = z.uuid().safeParse(claimId);
  if (!id.success) return { error: NOT_FOUND };
  const input = CheckInput.safeParse({
    finalAmount: textField(formData, "finalAmount"),
    finalNote: textField(formData, "finalNote"),
    verifiedWithVicky: formData.get("verifiedWithVicky") === "on",
  });
  if (!input.success) {
    return { error: input.error.issues[0]?.message ?? TRY_AGAIN };
  }

  const supabase = await createClient();
  const found = await supabase
    .from("travel_claims")
    .select(
      "profile_id, status, petrol_parking_toll, outstation, hotel, others, overtime, verified_with_vicky_on",
    )
    .eq("id", id.data)
    .maybeSingle();
  if (found.error) {
    logServerError("Could not load the travel claim", found.error, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN };
  }
  if (!found.data) return { error: NOT_FOUND };
  const claim = claimRow.parse(found.data);
  if (claim.profile_id === me.id) return { error: NOT_ALLOWED };
  if (claim.status !== "submitted") return { error: MOVED_ON };

  const total = travelClaimTotal({
    petrolParkingToll: claim.petrol_parking_toll,
    outstation: claim.outstation,
    hotel: claim.hotel,
    others: claim.others,
    overtime: claim.overtime,
  });
  const { finalAmount, finalNote, verifiedWithVicky } = input.data;
  const saved = await supabase
    .from("travel_claims")
    .update({
      final_amount:
        finalAmount === null || toCents(finalAmount) === toCents(total)
          ? null
          : finalAmount,
      final_note: finalNote,
      verified_with_vicky_on: verifiedWithVicky
        ? (claim.verified_with_vicky_on ?? todayMyt())
        : null,
      status: next,
    })
    .eq("id", id.data)
    .eq("status", "submitted")
    .select("id");
  if (saved.error) {
    if (saved.error.code === "42501") {
      return {
        error: saved.error.message.includes(NO_REPORT)
          ? NO_REPORT
          : NOT_ALLOWED,
      };
    }
    logServerError("Could not check the travel claim", saved.error, {
      profileId: me.id,
      recordId: id.data,
    });
    return { error: TRY_AGAIN };
  }
  if (saved.data.length === 0) return { error: MOVED_ON };
  revalidatePath("/claims");
  return { error: null };
}

/** Save: stores the final amount, note and Vicky tick; the claim stays submitted (demo Save). */
export async function saveTravelClaimCheck(
  claimId: string,
  formData: FormData,
) {
  return checkClaim(claimId, formData, "submitted");
}

/** Return: keeps what was typed and sends the claim back to the person as a draft (demo tcRet). */
export async function returnTravelClaim(claimId: string, formData: FormData) {
  return checkClaim(claimId, formData, "draft");
}

/** Release: pays the claim out and locks it; needs the same month's monthly report in (D3). */
export async function releaseTravelClaim(claimId: string, formData: FormData) {
  return checkClaim(claimId, formData, "released");
}
