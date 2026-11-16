"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { allowanceListForm, claimCapForm } from "./package-schemas";

export type SettingsResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";

const standardForm = z.object({
  position: z.enum(["sales", "site"], { error: "Choose the position." }),
  allowances: allowanceListForm,
  claimCap: claimCapForm,
});

/** Changes the usual package for a position. Packages already recorded stay as they are. */
export async function updateStandardPackage(
  input: unknown,
): Promise<SettingsResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = standardForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("standard_packages")
    .update({
      allowances: parsed.data.allowances,
      claim_cap: parsed.data.claimCap,
    })
    .eq("position", parsed.data.position);
  return finish(error, me.id, parsed.data.position);
}

const rate = (message: string) =>
  z
    .number({ error: message })
    .min(0, "An amount can't be below zero.")
    .max(99999, "That amount is too large.");

const outstationForm = z.object({
  breakfast: rate("Key in the breakfast amount."),
  lunch: rate("Key in the lunch amount."),
  dinner: rate("Key in the dinner amount."),
  hotelStaff: rate(
    "Key in the hotel budget for salespeople and site supervisors.",
  ),
  hotelManager: rate("Key in the hotel budget for managers."),
  hotelDirector: rate("Key in the hotel budget for directors."),
});

/** Changes the outstation meal allowance and the hotel budget per night by level. */
export async function updateOutstationRules(
  input: unknown,
): Promise<SettingsResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = outstationForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("outstation_rules")
    .update({
      breakfast: form.breakfast,
      lunch: form.lunch,
      dinner: form.dinner,
      hotel_staff: form.hotelStaff,
      hotel_manager: form.hotelManager,
      hotel_director: form.hotelDirector,
    })
    .eq("id", true);
  return finish(error, me.id, "outstation-rules");
}

function finish(
  error: { code?: string; message?: string } | null,
  profileId: string,
  recordId: string,
): SettingsResult {
  if (!error) {
    revalidatePath("/hr");
    return { error: null };
  }
  if (error.code === "42501") return { error: NOT_ALLOWED };
  logServerError("Could not save the HR setting", error, {
    profileId,
    recordId,
  });
  return { error: TRY_AGAIN };
}
