"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import { categoriesSchema } from "./marketing-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";

export type CategoriesResult = { error: string | null };

/**
 * Saves the category list as the dialog left it: new rows added, names changed, order kept, and
 * rows missing from the list deleted. The database refuses to delete a category any expense uses.
 */
export async function saveMarketingCategories(
  input: unknown,
): Promise<CategoriesResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = categoriesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const list = parsed.data;

  const supabase = await createClient();
  const current = await supabase.from("marketing_categories").select("id");
  if (current.error) {
    logServerError("Could not read the marketing categories", current.error, {
      profileId: me.id,
    });
    return { error: TRY_AGAIN };
  }
  const kept = new Set(list.map((category) => category.id));
  const removed = z
    .array(z.object({ id: z.uuid() }))
    .parse(current.data)
    .map((row) => row.id)
    .filter((id) => !kept.has(id));

  if (removed.length > 0) {
    const { error } = await supabase
      .from("marketing_categories")
      .delete()
      .in("id", removed);
    if (error) {
      if (error.code === "23503") {
        return {
          error:
            "A category that expenses still use can't be deleted. Reload the page.",
        };
      }
      if (error.code === "42501") return { error: NOT_EDITOR };
      logServerError("Could not delete marketing categories", error, {
        profileId: me.id,
      });
      return { error: TRY_AGAIN };
    }
  }

  const { error } = await supabase.from("marketing_categories").upsert(
    list.map((category, index) => ({
      id: category.id,
      name: category.name,
      sort_order: index + 1,
    })),
    { onConflict: "id" },
  );
  if (error) {
    if (error.code === "23505") {
      return { error: "Two categories have the same name." };
    }
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not save the marketing categories", error, {
      profileId: me.id,
    });
    return { error: TRY_AGAIN };
  }

  revalidatePath("/marketing");
  return { error: null };
}
