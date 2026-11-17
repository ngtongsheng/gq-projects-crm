"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { canFileClaim } from "@/lib/domain/claim-eligibility";
import { todayMyt } from "@/lib/format/date";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { travelClaimMonths } from "./claim-month";
import { loadClaimSettings } from "./claim-settings-data";
import { readTravelClaim } from "./travel-claim-input";

export type TravelClaimResult =
  | { error: string }
  /** `updated` is true when the claim was already with Jany and only its figures changed. */
  | { error: null; updated: boolean };

const TRY_AGAIN = "Could not save. Try again.";
const NOT_FILER = "Your role does not file a travel claim.";
const WRONG_MONTH = "Pick a claim month from the list.";
const RELEASED = "This claim is released, so it can't be changed now.";

/**
 * Saves the person's travel claim for a claim month and sends it to Jany: the first time it is
 * submitted, afterwards ("Update") it stays submitted until she releases it. Their own claim
 * only; row-level security and guard_travel_claim_write hold the line in the database.
 */
export async function submitTravelClaim(
  formData: FormData,
): Promise<TravelClaimResult> {
  const me = await requirePage("claims");
  if (!canFileClaim(me)) return { error: NOT_FILER };

  const parsed = readTravelClaim(formData, me.jobRole === "site");
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? TRY_AGAIN };
  }
  const { month, ...figures } = parsed.data;
  const settings = await loadClaimSettings();
  if (!travelClaimMonths(todayMyt(), settings.cutOffDay).includes(month)) {
    return { error: WRONG_MONTH };
  }

  const row = {
    petrol_parking_toll: figures.petrolParkingToll,
    outstation: figures.outstation,
    hotel: figures.hotel,
    others: figures.others,
    others_description: figures.othersDescription,
    overtime: figures.overtime,
    remark: figures.remark,
    status: "submitted" as const,
  };
  const supabase = await createClient();
  const find = () =>
    supabase
      .from("travel_claims")
      .select("id, status")
      .eq("profile_id", me.id)
      .eq("month", month)
      .maybeSingle();

  let existing = await find();
  if (existing.error) {
    logServerError("Could not load the travel claim", existing.error, {
      profileId: me.id,
      month,
    });
    return { error: TRY_AGAIN };
  }
  if (!existing.data) {
    const started = await supabase
      .from("travel_claims")
      .insert({ month, ...row });
    if (!started.error) {
      revalidatePath("/claims");
      return { error: null, updated: false };
    }
    // Another tab started it first: update theirs.
    if (started.error.code !== "23505") {
      logServerError("Could not start the travel claim", started.error, {
        profileId: me.id,
        month,
      });
      return { error: TRY_AGAIN };
    }
    existing = await find();
  }
  const claim = existing.data;
  if (existing.error || !claim) return { error: TRY_AGAIN };
  if (claim.status === "released") return { error: RELEASED };

  const saved = await supabase
    .from("travel_claims")
    .update(row)
    .eq("id", claim.id)
    .select("id");
  if (saved.error || saved.data.length === 0) {
    if (saved.error?.code === "42501") return { error: RELEASED };
    logServerError("Could not update the travel claim", saved.error, {
      profileId: me.id,
      recordId: claim.id,
    });
    return { error: TRY_AGAIN };
  }
  revalidatePath("/claims");
  return { error: null, updated: claim.status === "submitted" };
}
