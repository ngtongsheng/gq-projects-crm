"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canStartQuote } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { optionalId, textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { normaliseQuoteNo } from "./quote-number";

export type CreateQuoteResult = {
  error: string | null;
  quoteId?: string;
  /** The number was already registered, so its costing is opened instead of a new one. */
  existing?: boolean;
};

const fail = (error: string): CreateQuoteResult => ({ error });

const NOT_SELLER = "Only salespeople start a costing.";
const TRY_AGAIN = "Could not start the costing. Try again.";
// The demo's page names, which would clash with the screens' addresses.
const RESERVED = ["REGISTER", "NEW", "APPROVAL", "ENQUIRY", "TEAM"];

/** The salesperson's own quotation number. */
const quoteNo = z
  .string()
  .transform(normaliseQuoteNo)
  .pipe(
    z
      .string()
      .min(1, "Key in the quotation number.")
      .max(40, "Keep the quotation number under 40 characters.")
      .refine((no) => !RESERVED.includes(no), "This number can't be used.")
      .refine(
        (no) => !/-R\d+$/.test(no),
        "Key in the base number, for example GQ5127. A revision is opened from the costing itself.",
      ),
  );

const name = (label: string) =>
  z.string().trim().max(200, `Keep the ${label} under 200 characters.`);

const quoteForm = z.object({
  quoteNo,
  projectId: optionalId("Pick a project from the list."),
  projectName: name("project name"),
  customerName: name("customer name"),
});

const idRow = z.object({ id: z.string() });

type DbError = { code?: string; message?: string };

/** A plain message for a refusal from the database; anything else is logged. */
function dbMessage(error: DbError): string {
  if (error.code === "42501") return NOT_SELLER;
  console.error("Could not start costing", error);
  return TRY_AGAIN;
}

/**
 * Starts a costing under the signed-in salesperson: the quote, its Original revision as a draft,
 * an empty Option A and the "created" history line. An existing number opens its costing, as in
 * the demo. The salesperson is always the person signed in, whatever the form posts.
 */
export async function createQuote(
  formData: FormData,
): Promise<CreateQuoteResult> {
  const me = await requirePage("cost");
  if (!canStartQuote(me.jobRole)) return fail(NOT_SELLER);

  const parsed = quoteForm.safeParse({
    quoteNo: textField(formData, "quoteNo"),
    projectId: textField(formData, "projectId"),
    projectName: textField(formData, "projectName"),
    customerName: textField(formData, "customerName"),
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  }
  const form = parsed.data;
  const supabase = await createClient();

  if (form.projectId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("id", form.projectId)
      .maybeSingle();
    if (error) return fail(dbMessage(error));
    if (!data) return fail("Could not find that project. Reload the page.");
  }

  const quote = await supabase
    .from("quotes")
    .insert({
      quote_no: form.quoteNo,
      project_id: form.projectId,
      project_name: form.projectName,
      customer_name: form.customerName,
      salesperson_id: me.id,
    })
    .select("id")
    .single();
  if (quote.error?.code === "23505") {
    const found = await supabase
      .from("quotes")
      .select("id")
      .eq("quote_no", form.quoteNo)
      .maybeSingle();
    if (found.error) return fail(dbMessage(found.error));
    // Someone else's costing is hidden from this person by the database.
    if (!found.data) {
      return fail("That quotation number belongs to another costing.");
    }
    return {
      error: null,
      quoteId: idRow.parse(found.data).id,
      existing: true,
    };
  }
  if (quote.error) return fail(dbMessage(quote.error));
  const quoteId = idRow.parse(quote.data).id;

  const revision = await supabase
    .from("quote_revisions")
    .insert({ quote_id: quoteId, rev: 0, status: "draft" })
    .select("id")
    .single();
  if (revision.error) return fail(dbMessage(revision.error));
  const revisionId = idRow.parse(revision.data).id;

  const option = await supabase
    .from("quote_options")
    .insert({ revision_id: revisionId, key: "A", label: "" });
  if (option.error) return fail(dbMessage(option.error));
  const history = await supabase
    .from("quote_revision_history")
    .insert({ revision_id: revisionId, action: "created" });
  if (history.error) return fail(dbMessage(history.error));

  revalidatePath("/costing");
  return { error: null, quoteId };
}
