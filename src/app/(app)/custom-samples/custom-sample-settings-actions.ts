"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { keepsCustomSamples } from "./custom-sample-access";
import type { CustomSampleResult } from "./custom-sample-actions";
import { loanDaysSchema } from "./custom-sample-input";

const NOT_KEEPER = "Only the office changes the loan period.";

/** Saves the loan period. Loans already out keep their return-by date. */
export async function saveCustomSampleLoanDays(
  formData: FormData,
): Promise<CustomSampleResult> {
  const me = await requirePage("tuft");
  if (!keepsCustomSamples(me.jobRole)) return { error: NOT_KEEPER };
  const parsed = loanDaysSchema.safeParse(textField(formData, "loanDays"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the days." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: "customSamples", value: { loanDays: parsed.data } },
      { onConflict: "key" },
    );
  if (error) {
    if (error.code === "42501") return { error: NOT_KEEPER };
    logServerError("Could not save the custom sample loan period", error, {
      profileId: me.id,
    });
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/custom-samples");
  return { error: null };
}
