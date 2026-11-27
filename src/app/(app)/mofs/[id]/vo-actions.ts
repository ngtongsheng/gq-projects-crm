"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditRegister } from "@/lib/auth/job-role";
import { seesMofCost } from "@/lib/auth/page-access";
import { requirePage } from "@/lib/auth/require-page";
import { optionalText, textField } from "@/lib/form/form-fields";
import { parseRm } from "@/lib/format/money";
import { logServerError } from "@/lib/log-server-error";
import { createClient } from "@/lib/supabase/server";
import { mofIdSchema } from "../schemas";

export type VariationOrderResult = {
  error: string | null;
  /** The job was completed and is now open again for the additional work. */
  reopened?: boolean;
};

const NOT_EDITOR =
  "Only the MD, Purchasing or HR & Accounts can add or change variation orders.";
const NOT_COST_READER =
  "Only the MD, Purchasing and HR & Accounts can see or set the cost.";
const RELOAD = "Could not find that variation order. Reload the page.";
const TRY_AGAIN = "Could not save the variation order. Try again.";
// Start of the database's own refusal when a lower VO would take the order total below the payments received.
const BELOW_RECEIVED = "The order total can't go below RM";

const rm = (message: string) =>
  z
    .string()
    .trim()
    .transform((text) => parseRm(text))
    .pipe(z.number(message));

const variationOrderForm = z
  .object({
    mofId: mofIdSchema,
    voNo: z.string().trim().min(1, "Enter the VO no.").max(30),
    clientRef: optionalText(100),
    confirmedOn: z.iso.date("Key in the date the VO was confirmed."),
    amount: rm(
      "Key in the VO amount in RM, negative for an omission or credit note.",
    ),
    description: z
      .string()
      .trim()
      .min(1, "Write what the additional work or VO is.")
      .max(300, "Keep the description under 300 characters."),
    qty: optionalText(100),
    needsWork: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
    notify: z.array(z.uuid()),
  })
  .refine((vo) => vo.amount !== 0 || vo.needsWork, {
    message:
      "Key in the VO amount. It can be 0 only for additional work with no charge.",
    path: ["amount"],
  });

const costSchema = rm("Enter the cost as an amount in RM.").pipe(
  z.number().min(0, "The cost can't be negative."),
);

type DbError = { code?: string; message?: string };

function dbMessage(
  error: DbError,
  voNo: string,
  context: { profileId: string; mofId: string; recordId?: string },
): string {
  if (error.code === "42501") {
    return error.message?.includes("mof_variation_order_costs")
      ? NOT_COST_READER
      : NOT_EDITOR;
  }
  if (error.code === "23505") {
    return `${voNo} is already used on this MOF. Use the next VO no.`;
  }
  if (error.code === "P0002") return RELOAD;
  if (error.code === "23514" && error.message?.startsWith(BELOW_RECEIVED)) {
    return error.message;
  }
  logServerError("Could not save variation order", error, context);
  return TRY_AGAIN;
}

/**
 * Adds a variation order to an MOF, or changes one when the form carries a voId. A new VO that
 * needs work on a job the site completed reopens it and alerts the ticked site supervisors.
 */
export async function saveVariationOrder(
  formData: FormData,
): Promise<VariationOrderResult> {
  const me = await requirePage("mof");
  if (!canEditRegister(me.jobRole)) return { error: NOT_EDITOR };

  const voId = textField(formData, "voId") || null;
  if (voId && !z.uuid().safeParse(voId).success) return { error: RELOAD };

  // A posted cost from someone who may not see cost is refused, not ignored.
  let cost: number | null = null;
  if (formData.has("cost")) {
    if (!(await seesMofCost(me))) return { error: NOT_COST_READER };
    const costText = textField(formData, "cost");
    if (costText.trim() !== "") {
      const parsedCost = costSchema.safeParse(costText);
      if (!parsedCost.success) {
        return {
          error: parsedCost.error.issues[0]?.message ?? "Check the cost.",
        };
      }
      cost = parsedCost.data;
    }
  }

  const parsed = variationOrderForm.safeParse({
    mofId: textField(formData, "mofId"),
    voNo: textField(formData, "voNo"),
    clientRef: textField(formData, "clientRef"),
    confirmedOn: textField(formData, "confirmedOn"),
    amount: textField(formData, "amount"),
    description: textField(formData, "description"),
    qty: textField(formData, "qty"),
    needsWork: formData.get("needsWork") ?? undefined,
    notify: formData.getAll("notifyId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const vo = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_variation_order", {
    variation_order_id: voId,
    mof_id: vo.mofId,
    vo: {
      vo_no: vo.voNo,
      client_ref: vo.clientRef,
      confirmed_on: vo.confirmedOn,
      amount: vo.amount,
      description: vo.description,
      qty: vo.qty,
      needs_work: vo.needsWork,
    },
    cost,
    notify: vo.notify,
  });
  if (error) {
    return {
      error: dbMessage(error, vo.voNo, {
        profileId: me.id,
        mofId: vo.mofId,
        recordId: voId || undefined,
      }),
    };
  }

  revalidatePath("/mofs");
  revalidatePath(`/mofs/${vo.mofId}`);
  return { error: null, reopened: z.boolean().parse(data) };
}
