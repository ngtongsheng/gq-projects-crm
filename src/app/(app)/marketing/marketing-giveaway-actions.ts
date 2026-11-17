"use server";

import { revalidatePath } from "next/cache";
import { requirePage } from "@/lib/auth/require-page";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { editsMarketing } from "./marketing-access";
import { giveawayId, giveawaySchema } from "./marketing-giveaway-input";
import { NOT_EDITOR, TRY_AGAIN } from "./marketing-refusal";

export type GiveawayResult = { error: string | null };

const NOT_FOUND = "Could not find that give-away. Reload the page.";

/** Adds a give-away line, or saves changes to one. The total (qty x unit cost) is worked out by the database. */
export async function saveGiveaway(input: unknown): Promise<GiveawayResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = giveawaySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const { id, ...form } = parsed.data;

  const fields = {
    given_on: form.givenOn,
    supplier: form.supplier,
    invoice_no: form.invoiceNo,
    item: form.item,
    given_to: form.givenTo,
    qty: form.qty,
    unit_cost: form.unitCost,
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("marketing_giveaways")
        .update(fields)
        .eq("id", id)
        .select("id")
    : await supabase.from("marketing_giveaways").insert(fields).select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not save the give-away", error, {
      profileId: me.id,
      recordId: id ?? undefined,
    });
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}

export async function deleteGiveaway(id: string): Promise<GiveawayResult> {
  const me = await requirePage("mkt");
  if (!editsMarketing(me.jobRole)) return { error: NOT_EDITOR };
  const parsed = giveawayId.safeParse(id);
  if (!parsed.success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_giveaways")
    .delete()
    .eq("id", parsed.data)
    .select("id");
  if (error) {
    if (error.code === "42501") return { error: NOT_EDITOR };
    logServerError("Could not delete the give-away", error, {
      profileId: me.id,
      recordId: parsed.data,
    });
    return { error: "Could not delete. Try again." };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/marketing");
  return { error: null };
}
