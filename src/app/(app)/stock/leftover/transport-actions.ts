"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditStock } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import type { LeftoverResult } from "./actions";
import { transportFields } from "./leftover-fields";

const NOT_STOCK = "Only the people who arrange stock can arrange transport.";
const NOT_FOUND = "Could not find those items. Reload the page.";
const TRY_AGAIN = "Could not save. Try again.";

const transportForm = z.object({
  leftoverIds: z
    .array(z.uuid({ error: NOT_FOUND }))
    .min(1, NOT_FOUND)
    .max(50, NOT_FOUND),
  ...transportFields,
  transportBy: transportFields.transportBy.refine((by) => by !== null, {
    error: "Choose who takes it.",
  }),
  transportOn: transportFields.transportOn.refine((on) => on !== null, {
    error: "Enter the pickup date.",
  }),
});

/**
 * Purchasing names who takes the stock back (Lalamove, lorry), for every item of one site
 * still waiting for transport (the demo's "Transport arranged").
 */
export async function arrangeLeftoverTransport(
  formData: FormData,
): Promise<LeftoverResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = transportForm.safeParse({
    leftoverIds: formData
      .getAll("leftoverId")
      .filter((id): id is string => typeof id === "string"),
    transportBy: textField(formData, "transportBy"),
    transportOn: textField(formData, "transportOn"),
    transportTo: textField(formData, "transportTo"),
    transportCost: textField(formData, "transportCost"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const transport = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leftovers")
    .update({
      transport_by: transport.transportBy,
      transport_on: transport.transportOn,
      transport_to: transport.transportTo,
      transport_cost: transport.transportCost,
    })
    .in("id", transport.leftoverIds)
    // Only items going back by transport that nobody has been named for yet.
    .eq("return_method", "transport")
    .is("transport_by", null)
    .select("id, mof_id");
  if (error) {
    if (error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not arrange the leftover transport", error);
    return { error: TRY_AGAIN };
  }
  if (data.length === 0) return { error: NOT_FOUND };

  revalidatePath("/stock/leftover");
  for (const mofId of new Set(data.map((row) => row.mof_id))) {
    revalidatePath(`/site-work/${mofId}`);
  }
  return { error: null };
}
