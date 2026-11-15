"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { createClient } from "@/lib/supabase/server";
import { projectValueOf } from "./project-value";
import { loadQuote } from "./quote-data";

export type UseAsProjectValueResult = { error: string | null };

const fail = (error: string): UseAsProjectValueResult => ({ error });

const input = z.object({ projectId: z.uuid(), quoteId: z.uuid() });

const NOT_FOUND = "Could not find this costing or project. Reload the page.";
const TRY_AGAIN = "Could not set the project value. Try again.";

/**
 * Copies an OK-to-quote costing's amount onto its project's value, for a project with no MOF yet
 * (once an MOF exists its contract sum is the value). Only the newest version counts: an older
 * one has been superseded. Whether the person may change the project is the database's call.
 */
export async function setValueFromCosting(
  raw: z.input<typeof input>,
): Promise<UseAsProjectValueResult> {
  const me = await requirePage("cost");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return fail(NOT_FOUND);
  const { projectId, quoteId } = parsed.data;

  const quote = await loadQuote(me, quoteId);
  if (!quote || quote.projectId !== projectId) return fail(NOT_FOUND);
  const latest = quote.revisions.at(-1);
  const value = latest ? projectValueOf(latest) : null;
  if (value === null) {
    return fail(
      "Only a costing that is OK to quote can set the project value.",
    );
  }

  const supabase = await createClient();
  const mof = await supabase
    .from("mofs")
    .select("id")
    .eq("project_id", projectId);
  if (mof.error) {
    console.error("Could not check the project's MOF", mof.error);
    return fail(TRY_AGAIN);
  }
  if (z.array(z.unknown()).parse(mof.data).length > 0) {
    return fail("This project has an MOF, so its value follows the MOF.");
  }

  const updated = await supabase
    .from("projects")
    .update({ value })
    .eq("id", projectId)
    .select("id");
  if (updated.error) {
    console.error("Could not set the project value", updated.error);
    return fail(TRY_AGAIN);
  }
  if (z.array(z.unknown()).parse(updated.data).length === 0) {
    return fail(
      "Only the person in charge, the supporting salesperson, the MD or the Sales Director can change this project.",
    );
  }

  revalidatePath("/customers", "layout");
  revalidatePath("/projects");
  return { error: null };
}
