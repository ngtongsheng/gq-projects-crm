"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditLeaveSetup } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { FIRST_LEAVE_YEAR } from "@/lib/domain/leave-balance";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type EntitlementResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";

const personId = z.uuid({
  error: "Could not find that person. Reload the page.",
});
const year = z.coerce
  .number()
  .int()
  .min(FIRST_LEAVE_YEAR, `Leave balances start in ${FIRST_LEAVE_YEAR}.`)
  .max(2100);

// A blank box means 0, as in the demo. Whole and half days only, as the table checks.
const days = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .pipe(
      z
        .number(`${label}: key in a number of days.`)
        .min(0, `${label} cannot be below 0.`)
        .max(365, `${label} cannot be above 365.`)
        .refine(
          (value) => value % 0.5 === 0,
          `${label}: whole or half days only.`,
        ),
    );

const entitlementForm = z.object({
  personId,
  year,
  annualDays: days("Annual leave"),
  carriedDays: days("Carried forward"),
  mcDays: days("Medical leave"),
});

/** Sets one person's leave for one year, replacing the company default for them (demo leaveEnt). */
export async function saveEntitlement(
  formData: FormData,
): Promise<EntitlementResult> {
  const me = await requirePage("leave");
  if (!canEditLeaveSetup(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = entitlementForm.safeParse({
    personId: textField(formData, "personId"),
    year: textField(formData, "year"),
    annualDays: textField(formData, "annualDays"),
    carriedDays: textField(formData, "carriedDays"),
    mcDays: textField(formData, "mcDays"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  }
  const form = parsed.data;
  const values = {
    annual_days: form.annualDays,
    carried_days: form.carriedDays,
    mc_days: form.mcDays,
  };

  const supabase = await createClient();
  // Change the row if there is one, otherwise add it; the table has no upsert grant on its key.
  const changeRow = () =>
    supabase
      .from("leave_entitlements")
      .update(values)
      .eq("profile_id", form.personId)
      .eq("year", form.year)
      .select("profile_id");
  const changed = await changeRow();
  if (changed.error) return fail(changed.error);
  if (changed.data.length === 0) {
    const added = await supabase
      .from("leave_entitlements")
      .insert({ profile_id: form.personId, year: form.year, ...values });
    if (added.error?.code === "23505") {
      // Someone else added the row between our change and our add: change theirs, later values win.
      const retried = await changeRow();
      if (retried.error) return fail(retried.error);
      if (retried.data.length === 0) return fail(added.error);
    } else if (added.error) {
      return fail(added.error);
    }
  }
  revalidatePath("/leave");
  return { error: null };
}

/** Puts the person back on the company default for the year. */
export async function resetEntitlement(
  formData: FormData,
): Promise<EntitlementResult> {
  const me = await requirePage("leave");
  if (!canEditLeaveSetup(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = z.object({ personId, year }).safeParse({
    personId: textField(formData, "personId"),
    year: textField(formData, "year"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_entitlements")
    .delete()
    .eq("profile_id", parsed.data.personId)
    .eq("year", parsed.data.year);
  if (error) return fail(error);
  revalidatePath("/leave");
  return { error: null };
}

function fail(error: { code?: string; message?: string }): EntitlementResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  if (error.code === "23503") {
    return { error: "Could not find that person. Reload the page." };
  }
  console.error("Could not save the leave entitlement", error);
  return { error: TRY_AGAIN };
}
