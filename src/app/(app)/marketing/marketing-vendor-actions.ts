"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import { vendorId, vendorSchema } from "./marketing-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";

export type VendorResult = { error: string | null };

const NOT_FOUND = "Could not find that vendor. Reload the page.";

/** Adds a vendor or part-timer, or saves changes to one. A rename shows on every expense at once (linked by id). */
export async function saveMarketingVendor(
  input: unknown,
): Promise<VendorResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { id, ...form } = parsed.data;

  const fields = {
    kind: form.kind,
    name: form.name,
    supplies: form.supplies,
    contact_person: form.contactPerson,
    skills: form.skills,
    rate: form.rate,
    portfolio_url: form.portfolioUrl,
    phone: form.phone,
    email: form.email,
    notes: form.notes,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("marketing_vendors")
        .update(fields)
        .eq("id", id)
        .select("id")
    : await supabase.from("marketing_vendors").insert(fields).select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23505") {
      return { error: "A vendor with that name already exists." };
    }
    logServerError("Could not save the marketing vendor", error, {
      profileId: me.id,
      recordId: id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

/** Deletes a vendor nobody has been paid through; the database refuses while an expense or prepaid entry uses it. */
export async function deleteMarketingVendor(id: string): Promise<VendorResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = vendorId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_vendors")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    if (error.code === "23503") {
      return {
        error:
          "This vendor has expenses or prepaid entries, so it can't be deleted.",
      };
    }
    logServerError("Could not delete the marketing vendor", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}
