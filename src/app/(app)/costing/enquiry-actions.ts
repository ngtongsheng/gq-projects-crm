"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canRaiseEnquiry, canWorkEnquiries } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { textField } from "@/lib/form/form-fields";
import { createClient } from "@/lib/supabase/server";
import { sizesTotal } from "./enquiry-sizes";
import { DEFAULT_FX, EnquiryCurrency, EnquiryUnit } from "./enquiry-view";
import { normaliseQuoteNo } from "./quote-number";

export type EnquiryResult = { error: string | null };

const NOT_ALLOWED =
  "Only salespeople, Purchasing, the MD, Sales Director and HR & Accounts work FOB enquiries.";
const NOT_FOUND = "Could not find that enquiry. Reload the page.";
const TRY_AGAIN = "Could not save the enquiry. Try again.";

/** A number typed into a form; blank is saved as nothing. */
const optionalAmount = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((value) =>
      value === "" ? null : Number(value.replaceAll(",", "")),
    )
    .pipe(
      z
        .number({ error: `Enter the ${label} as a number.` })
        .min(0, `The ${label} cannot be negative.`)
        .max(max, `The ${label} is too large.`)
        .nullable(),
    );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep the ${label} under ${max} characters.`)
    .transform((value) => (value === "" ? null : value));

const quoteNoField = z
  .string()
  .transform(normaliseQuoteNo)
  .pipe(
    z
      .string()
      .max(40, "Keep the quotation number under 40 characters.")
      .transform((value) => (value === "" ? null : value)),
  );

const enquiryForm = z.object({
  enquiryId: z.union([z.literal(""), z.uuid()]),
  enquiryDate: z.iso.date("Choose the date."),
  quoteNo: quoteNoField,
  // "none" is the empty choice of the salesperson picker.
  salespersonId: z
    .union([z.literal(""), z.literal("none"), z.uuid()])
    .transform((value) => (value === "" || value === "none" ? null : value)),
  product: z.string().trim().min(1, "Enter the product or spec.").max(300),
  sizes: optionalText("sizes list", 4000),
  qty: optionalAmount("quantity", 999_999_999),
  unit: EnquiryUnit,
  supplier: optionalText("supplier", 200),
  currency: EnquiryCurrency,
  fob: optionalAmount("FOB", 999_999_999),
  fx: optionalAmount("exchange rate", 99_999),
  shipping: optionalAmount("shipping", 999_999_999),
  notes: optionalText("notes", 500),
});
type EnquiryForm = z.infer<typeof enquiryForm>;

const idRow = z.object({ salesperson_id: z.string() });

type DbError = { code?: string };

function dbMessage(error: DbError, what: string): string {
  if (error.code === "42501") return NOT_ALLOWED;
  console.error(`Could not ${what} the FOB enquiry`, error);
  return TRY_AGAIN;
}

/** The salesperson who owns the costing under this number, when the person can see it. */
async function quoteSalesperson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteNo: string | null,
): Promise<string | null> {
  if (!quoteNo) return null;
  const { data, error } = await supabase
    .from("quotes")
    .select("salesperson_id")
    .eq("quote_no", quoteNo)
    .maybeSingle();
  if (error || !data) return null;
  return idRow.parse(data).salesperson_id;
}

/** What the person who raised the enquiry fills in. */
function requestColumns(form: EnquiryForm) {
  // A size list adds up to the area, as in the demo.
  const total = form.sizes === null ? null : sizesTotal(form.sizes);
  return {
    enquiry_date: form.enquiryDate,
    quote_no: form.quoteNo,
    product: form.product,
    sizes: form.sizes,
    qty: total ? total.area : form.qty,
    unit: total ? ("m2" as const) : form.unit,
    supplier: form.supplier,
  };
}

/** Purchasing's reply. Who replied and when is stamped by the database from the signed-in person. */
function replyColumns(form: EnquiryForm) {
  return {
    currency: form.currency,
    fob: form.fob,
    // A blank rate takes the usual one once there is a price, as in the demo.
    fx: form.fob && !form.fx ? DEFAULT_FX[form.currency] : form.fx,
    shipping: form.shipping,
    notes: form.notes,
  };
}

/**
 * Raises an FOB enquiry, or changes one when the form carries an enquiryId. A salesperson keeps
 * their own and fills in what they ask for; only the enquiry desk (Purchasing, the MD, Sales
 * Director, HR & Accounts) gives the reply: currency, FOB, rate, shipping and notes.
 */
export async function saveEnquiry(formData: FormData): Promise<EnquiryResult> {
  const me = await requirePage("cost");
  const desk = canWorkEnquiries(me.jobRole);
  if (!desk && !canRaiseEnquiry(me.jobRole)) return { error: NOT_ALLOWED };

  const parsed = enquiryForm.safeParse(
    Object.fromEntries(
      Object.keys(enquiryForm.shape).map((key) => [
        key,
        textField(formData, key),
      ]),
    ),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  }
  const form = parsed.data;
  const supabase = await createClient();

  const columns = desk
    ? { ...requestColumns(form), ...replyColumns(form) }
    : requestColumns(form);

  if (form.enquiryId === "") {
    const salespersonId = desk
      ? (form.salespersonId ?? (await quoteSalesperson(supabase, form.quoteNo)))
      : me.id;
    const { error } = await supabase
      .from("fob_enquiries")
      .insert({ ...columns, salesperson_id: salespersonId });
    if (error) return { error: dbMessage(error, "add") };
  } else {
    const salespersonId = desk
      ? (form.salespersonId ?? (await quoteSalesperson(supabase, form.quoteNo)))
      : undefined;
    const { data, error } = await supabase
      .from("fob_enquiries")
      .update(
        salespersonId === undefined
          ? columns
          : { ...columns, salesperson_id: salespersonId },
      )
      .eq("id", form.enquiryId)
      .select("id");
    if (error) return { error: dbMessage(error, "save") };
    if (data.length === 0) return { error: NOT_FOUND };
  }

  revalidateEnquiries();
  return { error: null };
}

/** Removes an enquiry. A salesperson can drop their own only until Purchasing has replied. */
export async function deleteEnquiry(enquiryId: string): Promise<EnquiryResult> {
  const me = await requirePage("cost");
  const desk = canWorkEnquiries(me.jobRole);
  if (!desk && !canRaiseEnquiry(me.jobRole)) return { error: NOT_ALLOWED };
  if (!z.uuid().safeParse(enquiryId).success) return { error: NOT_FOUND };

  const supabase = await createClient();
  const removal = supabase.from("fob_enquiries").delete().eq("id", enquiryId);
  const { data, error } = await (desk
    ? removal
    : removal.eq("status", "pending")
  ).select("id");
  if (error) return { error: dbMessage(error, "remove") };
  if (data.length === 0) {
    return {
      error: desk
        ? NOT_FOUND
        : "Purchasing has already replied, so only they can remove this enquiry.",
    };
  }

  revalidateEnquiries();
  return { error: null };
}

function revalidateEnquiries() {
  revalidatePath("/costing/enquiries");
  revalidatePath("/costing/[id]", "page");
}
