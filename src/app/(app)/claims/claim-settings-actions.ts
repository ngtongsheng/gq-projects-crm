"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { canManageClaims } from "@/lib/domain/claim-flow";
import { ClaimSettings } from "@/lib/domain/monthly-claim";
import { createClient } from "@/lib/supabase/server";

export type ClaimSettingsResult = { error: string | null };

const NOT_ALLOWED =
  "Only the MD or HR & Accounts can change the claim settings.";
const TRY_AGAIN = "Could not save. Try again.";

// A blank field becomes NaN, which the schema rejects with the field's own message.
const numberField = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : Number.NaN;
};

/** Saves the claim settings. The database lets the MD, admins and HR & Accounts write the 'claims' setting. */
export async function saveClaimSettings(
  formData: FormData,
): Promise<ClaimSettingsResult> {
  const me = await requirePage("claims");
  if (!canManageClaims(me.jobRole)) return { error: NOT_ALLOWED };

  const parsed = ClaimSettings.safeParse({
    cutOffDay: numberField(formData, "cutOffDay"),
    mileageRatePerKm: numberField(formData, "mileageRatePerKm"),
    kmPerDay: numberField(formData, "kmPerDay"),
    monthlyTravelLimit: numberField(formData, "monthlyTravelLimit"),
    needReport: formData.get("needReport") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "claims", value: parsed.data }, { onConflict: "key" });
  if (error) {
    if (error.code === "42501") return { error: NOT_ALLOWED };
    console.error("Could not save the claim settings", error);
    return { error: TRY_AGAIN };
  }
  revalidatePath("/claims", "layout");
  return { error: null };
}
