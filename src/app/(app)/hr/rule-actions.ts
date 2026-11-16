"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";

export type RuleResult = { error: string | null };

const NOT_ALLOWED = "Only the Managing Director and HR & Accounts change this.";
const TRY_AGAIN = "Could not save. Try again.";

const ruleForm = z.object({
  startsOn: z.iso.date("Choose the date the rule starts."),
  rule: z
    .string()
    .trim()
    .min(1, "Key in the rule.")
    .max(2000, "Keep the rule under 2000 characters."),
});

/** Logs a rule added after the signed appendix; the database stamps who added it. */
export async function addExtraRule(formData: FormData): Promise<RuleResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = ruleForm.safeParse({
    startsOn: textField(formData, "startsOn"),
    rule: textField(formData, "rule"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hr_extra_rules")
    .insert({ starts_on: parsed.data.startsOn, rule: parsed.data.rule });
  if (error) return fail(error, me.id);
  revalidatePath("/hr");
  return { error: null };
}

export async function removeExtraRule(id: string): Promise<RuleResult> {
  const me = await requirePage("hr");
  if (!canSeeHr(me.jobRole)) return { error: NOT_ALLOWED };
  const parsed = z
    .uuid("Could not find that rule. Reload the page.")
    .safeParse(id);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? TRY_AGAIN };

  const supabase = await createClient();
  const { error } = await supabase
    .from("hr_extra_rules")
    .delete()
    .eq("id", parsed.data);
  if (error) return fail(error, me.id, parsed.data);
  revalidatePath("/hr");
  return { error: null };
}

function fail(
  error: { code?: string; message?: string },
  profileId: string,
  recordId?: string,
): RuleResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  logServerError("Could not save the rule", error, { profileId, recordId });
  return { error: TRY_AGAIN };
}
