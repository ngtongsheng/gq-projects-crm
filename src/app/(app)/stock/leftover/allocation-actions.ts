"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditStock } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { optionalText, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { positiveQuantity } from "../quantity-fields";
import type { LeftoverResult } from "./actions";

const NOT_STOCK =
  "Only the people who arrange stock can use leftover stock for a project.";
const NOT_FOUND = "Could not find that item or project. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const allocationForm = z.object({
  leftoverId: z.uuid({ error: NOT_FOUND }),
  projectId: z.uuid({ error: "Choose the project." }),
  qty: positiveQuantity,
  usedOn: z.iso.date("Enter the date."),
  note: optionalText(300, "Keep the note under 300 characters."),
});

/**
 * Uses leftover stock at Best Link for another project (the demo's "Use for project"). The
 * database refuses more than is left and stock that is not at Best Link, and says so in words.
 */
export async function allocateLeftover(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = allocationForm.safeParse({
    leftoverId: textField(formData, "leftoverId"),
    projectId: textField(formData, "projectId"),
    qty: textField(formData, "qty"),
    usedOn: textField(formData, "usedOn"),
    note: textField(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const use = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("leftover_allocations").insert({
    leftover_id: use.leftoverId,
    project_id: use.projectId,
    qty: use.qty,
    allocated_on: use.usedOn,
    note: use.note,
  });
  if (error) {
    if (error.code === "42501") return { error: NOT_STOCK };
    if (error.code === "23503") return { error: NOT_FOUND };
    // The guard trigger's own messages ("Only 4 left at Best Link.") are written for people.
    if (error.code === "23514") return { error: error.message };
    console.error("Could not use the leftover stock", error);
    return { error: TRY_AGAIN };
  }

  revalidatePath("/stock/leftover");
  return { error: null };
}
