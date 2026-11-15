"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";

export type FormLinkResult = { error: string | null };

const NOT_ALLOWED = "Only an admin adds or removes these links.";
const TRY_AGAIN = "Could not save. Try again.";

const linkForm = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Key in the form name.")
    .max(120, "Keep the name under 120 characters."),
  url: z
    .string()
    .trim()
    .max(500, "Keep the link under 500 characters.")
    .regex(/^https:\/\/\S+$/, "Key in the full https:// link."),
  note: optionalText(200),
});

/** Adds a Google Drive link to the forms list; the database allows admins only. */
export async function addFormLink(formData: FormData): Promise<FormLinkResult> {
  const me = await requirePage("tools");
  if (me.role !== "admin") return { error: NOT_ALLOWED };
  const parsed = linkForm.safeParse({
    name: textField(formData, "name"),
    url: textField(formData, "url"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("form_links").insert({
    name: parsed.data.name,
    url: parsed.data.url,
    note: parsed.data.note ?? "",
  });
  if (error) return fail(error);
  revalidatePath("/tools");
  return { error: null };
}

export async function removeFormLink(id: string): Promise<FormLinkResult> {
  const me = await requirePage("tools");
  if (me.role !== "admin") return { error: NOT_ALLOWED };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return { error: "Could not find that link. Reload the page." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("form_links")
    .delete()
    .eq("id", parsed.data);
  if (error) return fail(error);
  revalidatePath("/tools");
  return { error: null };
}

function fail(error: { code?: string; message?: string }): FormLinkResult {
  if (error.code === "42501") return { error: NOT_ALLOWED };
  console.error("Could not save the form link", error);
  return { error: TRY_AGAIN };
}
