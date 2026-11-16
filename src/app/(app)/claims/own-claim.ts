import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { CLAIM_STATUSES } from "@/lib/domain/claim-flow";
import { formatMonth } from "@/lib/format/date";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TRY_AGAIN = "Could not save. Try again.";
export const CLAIM_LOCKED =
  "This claim is with HR & Accounts now. Ask them to return it if you need to change it.";

const claimRow = z.object({ id: z.uuid(), status: z.enum(CLAIM_STATUSES) });

/** What a write by the person to their own claim may meet: a claim not theirs or not open to them. */
export const isNotAllowed = (error: { code?: string }) =>
  error.code === "42501";

/**
 * The person's claim for a month, started as a draft when there is none yet (one per person per
 * month, D1). Returns an error message when it is no longer theirs to change: only a draft or
 * a returned claim is.
 */
export async function openOwnClaim(
  supabase: Supabase,
  me: Profile,
  month: string,
): Promise<{ error: string } | { error: null; claimId: string }> {
  const find = () =>
    supabase
      .from("monthly_claims")
      .select("id, status")
      .eq("profile_id", me.id)
      .eq("month", month)
      .maybeSingle();

  let { data, error } = await find();
  if (error) {
    console.error("Could not load the monthly claim", error);
    return { error: TRY_AGAIN };
  }
  if (!data) {
    const started = await supabase
      .from("monthly_claims")
      .insert({ month })
      .select("id, status")
      .single();
    // Another tab started it first: use theirs.
    if (started.error?.code === "23505") {
      ({ data, error } = await find());
    } else {
      ({ data, error } = started);
    }
    if (error || !data) {
      console.error("Could not start the monthly claim", error);
      return { error: TRY_AGAIN };
    }
  }
  const claim = claimRow.parse(data);
  if (claim.status !== "draft" && claim.status !== "returned") {
    return {
      error: `Your ${formatMonth(month)} claim is already submitted. ${CLAIM_LOCKED}`,
    };
  }
  return { error: null, claimId: claim.id };
}
