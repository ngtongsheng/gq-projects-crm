"use server";

import { revalidatePath } from "next/cache";
import { canChangeSettings } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import {
  CommissionSettings,
  storedRows,
} from "@/lib/domain/commission-settings";
import { createClient } from "@/lib/supabase/server";

export type CommissionSettingsResult = { error: string | null };

const NOT_MD = "Only the MD or an admin can change the commission rules.";
const TRY_AGAIN = "Could not save. Try again.";

// A blank field becomes NaN, which the schema rejects with the field's own message.
const numberField = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : Number.NaN;
};

/** Saves the commission rules. The database lets only the MD and admins write app_settings. */
export async function saveCommissionSettings(
  formData: FormData,
): Promise<CommissionSettingsResult> {
  const me = await requirePage("comm");
  if (!canChangeSettings(me)) return { error: NOT_MD };

  const n = (key: string) => numberField(formData, key);
  const parsed = CommissionSettings.safeParse({
    baseRatePct: {
      own: n("baseOwn"),
      pass_down: n("basePassDown"),
      company: n("baseCompany"),
    },
    noCommissionBelowPct: n("noCommissionBelow"),
    lowMarginBelowPct: n("lowMarginBelow"),
    lowMarginRatePct: { own: n("lowOwn"), other: n("lowOther") },
    highMarginAbovePct: n("highMarginAbove"),
    highMarginBonusPct: n("highMarginBonus"),
    firstLateCut: { afterDays: n("firstCutDays"), cutPct: n("firstCutPct") },
    secondLateCut: {
      afterDays: n("secondCutDays"),
      cutPct: n("secondCutPct"),
    },
    claimThresholdPct: n("claimThreshold"),
    splitSharePct: n("splitShare"),
    flatPassDownRatePct: n("flatPassDown"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(storedRows(parsed.data), { onConflict: "key" });
  if (error) {
    if (error.code === "42501") return { error: NOT_MD };
    console.error("Could not save the commission settings", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/commission", "layout");
  revalidatePath("/projects");
  revalidatePath("/collection");
  return { error: null };
}
