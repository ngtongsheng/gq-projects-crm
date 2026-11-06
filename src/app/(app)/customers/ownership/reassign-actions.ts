"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/lib/auth/require-section";
import { createClient } from "@/lib/supabase/server";
import { canDecideOwnership } from "./ownership-access";
import { reassignSchema } from "./schemas";

export type ReassignResult = {
  error: string | null;
  /** How many customers changed hands. */
  moved: number;
};

const fail = (error: string): ReassignResult => ({ error, moved: 0 });

const NOT_ALLOWED = "Only the MD or the Sales Director can reassign customers.";
const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NO_DATA_FOUND = "P0002";

/**
 * The MD or Sales Director gives a customer, or every customer at its company, to one or two
 * salespeople. The database replaces the owners, keeps a record and closes open requests.
 */
export async function reassignCustomer(input: {
  contactId: string;
  ownerIds: string[];
  wholeCompany: boolean;
  reason: string;
}): Promise<ReassignResult> {
  const me = await requireSection("customers");
  if (!canDecideOwnership(me.jobRole)) return fail(NOT_ALLOWED);

  const parsed = reassignSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reassign_customers", {
    contact: parsed.data.contactId,
    new_owners: parsed.data.ownerIds,
    whole_company: parsed.data.wholeCompany,
    reason: parsed.data.reason,
  });
  if (error?.code === INSUFFICIENT_PRIVILEGE) return fail(NOT_ALLOWED);
  if (error?.code === INVALID_PARAMETER) {
    return fail(error.message || "Check the details.");
  }
  if (error?.code === NO_DATA_FOUND) {
    return fail("That customer no longer exists. Reload the page.");
  }
  if (error) {
    console.error("Could not reassign customers", error);
    return fail("Could not reassign. Try again.");
  }

  revalidatePath("/", "layout");
  return { error: null, moved: typeof data === "number" ? data : 0 };
}
