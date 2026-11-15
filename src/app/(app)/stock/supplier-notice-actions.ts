"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canEditStock } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { SUPPLIER_NOTICES } from "@/lib/domain/supplier-notice";
import { createClient } from "@/lib/supabase/server";

export type NoticeResult = { error: string | null };

const NOT_STOCK = "Only the people who arrange stock can mark emails as sent.";

const sentLines = z
  .array(
    z.object({
      id: z.uuid({
        error: "Could not find that reservation. Reload the page.",
      }),
      notice: z.enum(SUPPLIER_NOTICES),
    }),
  )
  .min(1, "Nothing to mark as sent.");

/**
 * Marks emails the person has sent. Each line matches on the notice the email carried, so a
 * line that was extended again in the meantime stays on the list.
 */
export async function markSupplierNoticesSent(
  lines: z.input<typeof sentLines>,
): Promise<NoticeResult> {
  const me = await requirePage("stock");
  if (!canEditStock(me)) return { error: NOT_STOCK };

  const parsed = sentLines.safeParse(lines);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }

  const supabase = await createClient();
  const sentAt = new Date().toISOString();
  const results = await Promise.all(
    parsed.data.map(({ id, notice }) =>
      supabase
        .from("stock_reservations")
        .update({ supplier_notified_at: sentAt })
        .eq("id", id)
        .eq("supplier_notice", notice)
        .is("supplier_notified_at", null),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    if (failed.error.code === "42501") return { error: NOT_STOCK };
    console.error("Could not mark the supplier emails as sent", failed.error);
    return { error: "Could not save. Try again." };
  }

  revalidatePath("/stock");
  return { error: null };
}
