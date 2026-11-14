"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { canDecideOwnership, canRequestOwnership } from "./ownership-access";
import { ownershipDecisionSchema, ownershipRequestSchema } from "./schemas";

export type OwnershipResult = { error: string | null };

const fail = (error: string): OwnershipResult => ({ error });

const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const NO_DATA_FOUND = "P0002";

/** A salesperson asks to take over a customer someone else owns. */
export async function requestOwnership(
  contactId: string,
  reason: string,
): Promise<OwnershipResult> {
  const me = await requirePage("cust");
  if (!canRequestOwnership(me.jobRole, false)) {
    return fail("Your role cannot ask for ownership of a customer.");
  }

  const parsed = ownershipRequestSchema.safeParse({ contactId, reason });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ownership_requests").insert({
    contact_id: parsed.data.contactId,
    reason: parsed.data.reason,
  });
  if (error?.code === UNIQUE_VIOLATION) {
    return fail("You already have a request open for this customer.");
  }
  // The policy refuses customers the person already owns.
  if (error?.code === INSUFFICIENT_PRIVILEGE) {
    return fail("You already own this customer.");
  }
  if (error) {
    console.error("Could not save ownership request", error);
    return fail("Could not send the request. Try again.");
  }

  revalidatePath("/", "layout");
  return { error: null };
}

/** The MD or Sales Director approves (owners become the requester) or rejects. */
export async function decideOwnershipRequest(
  requestId: string,
  approve: boolean,
): Promise<OwnershipResult> {
  const me = await requirePage("cust");
  if (!canDecideOwnership(me.jobRole)) {
    return fail("Only the MD or the Sales Director can decide requests.");
  }

  const parsed = ownershipDecisionSchema.safeParse({ requestId, approve });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the request.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_ownership_request", {
    request: parsed.data.requestId,
    approve: parsed.data.approve,
  });
  if (error?.code === NO_DATA_FOUND) {
    return fail("Someone already decided this request. Reload the page.");
  }
  if (error?.code === INSUFFICIENT_PRIVILEGE) {
    return fail("Only the MD or the Sales Director can decide requests.");
  }
  if (error) {
    console.error("Could not decide ownership request", error);
    return fail("Could not save the decision. Try again.");
  }

  revalidatePath("/", "layout");
  return { error: null };
}
