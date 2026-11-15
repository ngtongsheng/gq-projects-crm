"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditLeaveSetup } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type HolidayResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";

const holidayForm = z.object({
  day: z.iso.date("Choose the date."),
  name: z
    .string()
    .trim()
    .min(1, "Key in the name.")
    .max(100, "Keep the name under 100 characters."),
});

/** Adds a public holiday; a second one on the same day replaces the first (demo sheetHol). */
export async function addHoliday(formData: FormData): Promise<HolidayResult> {
  const me = await requirePage("leave");
  if (!canEditLeaveSetup(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = holidayForm.safeParse({
    day: textField(formData, "day"),
    name: textField(formData, "name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("public_holidays")
    .upsert(parsed.data, { onConflict: "day" });
  if (error) return fail(error);
  revalidatePath("/leave");
  return { error: null };
}

export async function removeHoliday(day: string): Promise<HolidayResult> {
  const me = await requirePage("leave");
  if (!canEditLeaveSetup(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = z.iso
    .date("Could not find that holiday. Reload the page.")
    .safeParse(day);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? TRY_AGAIN };

  const supabase = await createClient();
  const { error } = await supabase
    .from("public_holidays")
    .delete()
    .eq("day", parsed.data);
  if (error) return fail(error);
  revalidatePath("/leave");
  return { error: null };
}

function fail(error: { code?: string; message?: string }): HolidayResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  console.error("Could not save the public holiday", error);
  return { error: TRY_AGAIN };
}
