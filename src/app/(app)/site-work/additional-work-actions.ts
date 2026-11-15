"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export type NoteResult = { error: string | null };

const NOT_FOUND = "Could not find that notice. Reload the page.";

/** "OK, noted": the supervisor has seen the additional work. Only their own notice changes. */
export async function noteAdditionalWork(alertId: string): Promise<NoteResult> {
  const me = await requireRole("staff");
  if (!z.uuid().safeParse(alertId).success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("additional_work_alerts")
    .update({ noted_at: new Date().toISOString() })
    .eq("id", alertId)
    .eq("supervisor_id", me.id)
    .select("id");
  if (error) {
    console.error("Could not note additional work", error);
    return { error: "Could not save that. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/");
  return { error: null };
}
