"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditRegister } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { canMoveStage, moveWarning } from "@/lib/domain/mof-stages";
import { createClient } from "@/lib/supabase/server";
import { MofStage, mofIdSchema } from "./schemas";

export type StageResult = { error: string | null; warning?: string };

const currentRow = z.object({ stage: MofStage, payment_checked: z.boolean() });

/**
 * Moves an MOF to another stage from the register. The database only lets the MD,
 * Purchasing and HR & Accounts update MOFs; the check here gives a plain message first.
 */
export async function changeMofStage(
  mofId: string,
  stage: string,
): Promise<StageResult> {
  const me = await requirePage("mof");
  if (!canEditRegister(me.jobRole)) {
    return {
      error: "Only the MD, Purchasing or HR & Accounts can change an MOF.",
    };
  }

  const id = mofIdSchema.safeParse(mofId);
  const next = MofStage.safeParse(stage);
  if (!id.success || !next.success) {
    return { error: "Could not find that MOF. Reload the page." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select("stage, payment_checked")
    .eq("id", id.data)
    .maybeSingle();
  if (error) {
    console.error("Could not load MOF for stage change", error);
    return { error: "Could not change the stage. Try again." };
  }
  if (!data) return { error: "Could not find that MOF. Reload the page." };
  const current = currentRow.parse(data);

  if (!canMoveStage(current.stage, next.data)) {
    return {
      error: "This MOF can't move to that stage. Reload the page.",
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("mofs")
    .update({ stage: next.data })
    .eq("id", id.data)
    .select("id");
  if (updateError) {
    console.error("Could not change MOF stage", updateError);
    return { error: "Could not change the stage. Try again." };
  }
  if (updated.length === 0) {
    return {
      error: "Only the MD, Purchasing or HR & Accounts can change an MOF.",
    };
  }

  revalidatePath("/mofs");
  revalidatePath(`/mofs/${id.data}`);
  const warning = moveWarning(
    current.stage,
    next.data,
    current.payment_checked,
  );
  return warning ? { error: null, warning } : { error: null };
}
