"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canChangeSettings } from "@/lib/auth/job-role";
import { requireSection } from "@/lib/auth/require-section";
import { unijoyTargetFor } from "@/lib/domain/unijoy";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { UNIJOY_SETTING } from "./unijoy-data";

export type UnijoyTargetResult = { error: string | null };

const NOT_ALLOWED = "Only the MD or an admin can set the Unijoy target.";

const targetForm = z.object({
  year: z.coerce
    .number<string>("Choose the year.")
    .int("Choose the year.")
    .min(2000, "Choose the year.")
    .max(2100, "Choose the year."),
  target: z
    .string()
    .trim()
    .transform((text) => Number(text.replaceAll(",", "")))
    .pipe(
      z
        .number("Enter the target in m².")
        .positive("The target must be more than zero.")
        .max(100_000_000, "That target looks too big. Check it."),
    ),
});

/** Sets the Unijoy target, in m², for one year; the other years' targets stay as they were. */
export async function saveUnijoyTarget(
  formData: FormData,
): Promise<UnijoyTargetResult> {
  const me = await requireSection("dashboard");
  if (!canChangeSettings(me)) return { error: NOT_ALLOWED };

  const parsed = targetForm.safeParse({
    year: textField(formData, "year"),
    target: textField(formData, "target"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { year, target } = parsed.data;

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", UNIJOY_SETTING)
    .maybeSingle();
  if (loadError) {
    console.error("Could not read the Unijoy target", loadError);
    return { error: "Could not save the target. Try again." };
  }

  // Keep every other year's target; only this year changes.
  const kept =
    typeof existing?.value === "object" && existing.value !== null
      ? (existing.value as Record<string, unknown>)
      : {};
  const next: Record<string, number> = {};
  for (const key of Object.keys(kept)) {
    const value = unijoyTargetFor(kept, Number(key));
    if (value !== null) next[key] = value;
  }
  next[String(year)] = target;

  const { error } = await supabase
    .from("app_settings")
    .upsert([{ key: UNIJOY_SETTING, value: next }], { onConflict: "key" });
  if (error?.code === "42501") return { error: NOT_ALLOWED };
  if (error) {
    console.error("Could not save the Unijoy target", error);
    return { error: "Could not save the target. Try again." };
  }

  revalidatePath("/");
  return { error: null };
}
