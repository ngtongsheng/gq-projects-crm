"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { HOTEL_LEVELS } from "@/lib/domain/staff-package";
import { createClient } from "@/lib/supabase/server";
import {
  allowanceListForm,
  claimCapForm,
  httpsLinkForm,
} from "./package-schemas";

export type PackageResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";
const PERSON_MISSING = "Could not find that person. Reload the page.";

const personId = z.uuid({ error: PERSON_MISSING });

const detailsForm = z.object({
  confirmedOn: z.union([
    z.literal(""),
    z.iso.date("Choose the confirmation date."),
  ]),
  offerLetterLink: httpsLinkForm,
  note: z.string().trim().max(500, "Keep the notes under 500 characters."),
});

const packageForm = z.object({
  profileId: personId,
  effectiveOn: z.iso.date("Set the effective date."),
  basic: z
    .number({ error: "Key in the basic salary." })
    .gt(0, "Key in the basic salary.")
    .max(99999999, "That basic salary is too large."),
  allowances: allowanceListForm,
  claimCap: claimCapForm,
  hotelLevel: z.union([z.literal(""), z.enum(HOTEL_LEVELS)]),
  reason: z.string().trim().max(200, "Keep the reason under 200 characters."),
  details: detailsForm,
});

const detailsOnlyForm = z.object({
  profileId: personId,
  details: detailsForm,
});

type Details = z.infer<typeof detailsForm>;

async function upsertDetails(
  profileId: string,
  details: Details,
): Promise<PackageResult> {
  const supabase = await createClient();
  // Only these columns: the person's grade and signed appendix are kept as they are.
  const { error } = await supabase.from("staff_hr_records").upsert(
    {
      profile_id: profileId,
      confirmed_on: details.confirmedOn || null,
      offer_letter_link: details.offerLetterLink || null,
      note: details.note,
    },
    { onConflict: "profile_id" },
  );
  return error ? fail(error) : { error: null };
}

/**
 * Records a new package row from a date. Never edits an older row (loop 16 D4): a typo is fixed
 * by adding another row on a later date. The confirmation date, offer letter and notes are
 * saved with it, as in the demo.
 */
export async function addStaffPackage(input: unknown): Promise<PackageResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = packageForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("staff_packages").insert({
    profile_id: form.profileId,
    effective_on: form.effectiveOn,
    basic: form.basic,
    allowances: form.allowances,
    claim_cap: form.claimCap,
    hotel_level: form.hotelLevel || null,
    reason: form.reason,
  });
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "A package from that date is already recorded and can't be changed. Use a later date.",
      };
    }
    return fail(error);
  }

  const saved = await upsertDetails(form.profileId, form.details);
  revalidatePath("/hr");
  return saved.error
    ? {
        error: `The package is saved, but the details were not. ${saved.error}`,
      }
    : saved;
}

/** Saves the confirmation date, offer letter and notes without a new package. */
export async function saveStaffDetails(input: unknown): Promise<PackageResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = detailsOnlyForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const saved = await upsertDetails(parsed.data.profileId, parsed.data.details);
  if (!saved.error) revalidatePath("/hr");
  return saved;
}

function fail(error: { code?: string; message?: string }): PackageResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  console.error("Could not save the package", error);
  return { error: TRY_AGAIN };
}
