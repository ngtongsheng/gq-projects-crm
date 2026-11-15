"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { currentScheme, splitPolicies } from "@/lib/domain/hr-policy";
import { SALES_GRADES } from "@/lib/domain/hr-scheme";
import { createClient } from "@/lib/supabase/server";
import { loadPolicyDocuments } from "./policy-data";

export type GradeResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";
const PERSON_MISSING = "Could not find that person. Reload the page.";

const grade = z.enum(SALES_GRADES, { error: "Choose a grade." });

// A blank basic is allowed: the demo leaves it to be keyed in.
const gradeAmountForm = z.discriminatedUnion("field", [
  z.object({
    grade,
    field: z.literal("basic"),
    value: z
      .number({ error: "Key in the basic as a number." })
      .gt(0, "The basic must be above zero.")
      .max(99999999, "That basic is too large.")
      .nullable(),
  }),
  z.object({
    grade,
    field: z.literal("annualTarget"),
    value: z
      .number({ error: "Key in the annual target as a number." })
      .min(0, "The annual target can't be below zero.")
      .max(9999999999, "That annual target is too large."),
  }),
]);

/** Changes a grade's basic salary or annual target; the grades are seeded, so only these two change. */
export async function saveGradeAmount(input: unknown): Promise<GradeResult> {
  const me = await mayChangeHr();
  if (!me) return { error: NOT_ALLOWED };
  const parsed = gradeAmountForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { data } = parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_grades")
    .update(
      data.field === "basic"
        ? { basic: data.value }
        : { annual_target: data.value },
    )
    .eq("grade", data.grade);
  return finish(error);
}

const personGradeForm = z.object({
  profileId: z.uuid({ error: PERSON_MISSING }),
  grade: z.union([z.literal(""), grade]),
});

/** Sets a person's grade, or clears it. The appendix and the other HR details are kept as they are. */
export async function savePersonGrade(input: unknown): Promise<GradeResult> {
  const me = await mayChangeHr();
  if (!me) return { error: NOT_ALLOWED };
  const parsed = personGradeForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("staff_hr_records").upsert(
    {
      profile_id: parsed.data.profileId,
      grade: parsed.data.grade || null,
    },
    { onConflict: "profile_id" },
  );
  return finish(error);
}

const appendixForm = z.object({
  profileId: z.uuid({ error: PERSON_MISSING }),
  signedOn: z.union([z.literal(""), z.iso.date("Choose the date signed.")]),
});

/** Records the date a person signed the scheme appendix, stamped with the current version; blank clears it. */
export async function saveAppendixSigned(input: unknown): Promise<GradeResult> {
  const me = await mayChangeHr();
  if (!me) return { error: NOT_ALLOWED };
  const parsed = appendixForm.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { profileId, signedOn } = parsed.data;

  const version = signedOn
    ? (currentScheme(splitPolicies(await loadPolicyDocuments()).current)
        ?.version ?? null)
    : null;
  const supabase = await createClient();
  const { error } = await supabase.from("staff_hr_records").upsert(
    {
      profile_id: profileId,
      appendix_signed_on: signedOn || null,
      appendix_version: version,
    },
    { onConflict: "profile_id" },
  );
  return finish(error);
}

async function mayChangeHr(): Promise<boolean> {
  const me = await requirePage("hr");
  return canSeeHr(me.jobRole);
}

function finish(
  error: { code?: string; message?: string } | null,
): GradeResult {
  if (!error) {
    revalidatePath("/hr");
    return { error: null };
  }
  if (error.code === "42501") return { error: NOT_ALLOWED };
  console.error("Could not save the grade setting", error);
  return { error: TRY_AGAIN };
}
