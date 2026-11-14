"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import {
  countActions,
  type ImportCounts,
  type ImportPreview,
  toImportPreview,
} from "@/lib/import/import-plan";
import { createClient } from "@/lib/supabase/server";
import { canImportCustomers } from "./contact-access";
import {
  type CustomerImportContext,
  CustomerImportKind,
  companyImportFields,
  contactImportFields,
  importPayload,
  planCustomerImport,
} from "./customer-import";

const importRequest = z.object({
  kind: CustomerImportKind,
  text: z.string().max(1_000_000, "That paste is too big. Paste fewer rows."),
  onDuplicate: z.enum(["skip", "update"]),
});
export type CustomerImportRequest = z.input<typeof importRequest>;

export type PreviewImportResult = {
  error: string | null;
  preview: ImportPreview | null;
};

export type SaveImportResult = {
  error: string | null;
  counts: ImportCounts | null;
};

const UNIQUE_VIOLATION = "23505";
const NOT_ALLOWED = "Only the MD or the Sales Director can import customers.";

const idRows = z.array(z.object({ id: z.string(), name: z.string() }));
const mobileRows = z.array(z.object({ id: z.string(), mobile: z.string() }));

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function loadContext(
  supabase: Supabase,
): Promise<CustomerImportContext | null> {
  const [team, companies, contacts] = await Promise.all([
    getTeamDirectory(),
    supabase.from("companies").select("id, name"),
    supabase.from("contacts").select("id, mobile"),
  ]);
  if (companies.error || contacts.error) {
    console.error(
      "Could not load customers for import",
      companies.error ?? contacts.error,
    );
    return null;
  }
  return {
    team,
    companies: new Map(
      idRows
        .parse(companies.data)
        .map((row) => [row.name.toLowerCase(), row.id]),
    ),
    mobiles: new Map(
      mobileRows.parse(contacts.data).map((row) => [row.mobile, row.id]),
    ),
  };
}

/** Parses and checks a paste against the CRM without saving anything. */
export async function previewCustomerImport(
  input: CustomerImportRequest,
): Promise<PreviewImportResult> {
  const me = await requirePage("cust");
  if (!canImportCustomers(me.jobRole)) {
    return { error: NOT_ALLOWED, preview: null };
  }
  const request = importRequest.safeParse(input);
  if (!request.success) {
    return {
      error: request.error.issues[0]?.message ?? "Check the paste.",
      preview: null,
    };
  }
  const { kind, text, onDuplicate } = request.data;
  const context = await loadContext(await createClient());
  if (!context) {
    return { error: "Could not check the rows. Try again.", preview: null };
  }
  const planned = planCustomerImport(kind, text, onDuplicate, context);
  const preview =
    planned.kind === "companies"
      ? toImportPreview(planned.plan, companyImportFields)
      : toImportPreview(planned.plan, contactImportFields);
  return { error: null, preview };
}

/**
 * Saves the valid rows of a paste. The paste is parsed and checked again here
 * against fresh data, so nothing the browser showed or sent is trusted.
 */
export async function importCustomers(
  input: CustomerImportRequest,
): Promise<SaveImportResult> {
  const me = await requirePage("cust");
  if (!canImportCustomers(me.jobRole)) {
    return { error: NOT_ALLOWED, counts: null };
  }
  const request = importRequest.safeParse(input);
  if (!request.success) {
    return {
      error: request.error.issues[0]?.message ?? "Check the paste.",
      counts: null,
    };
  }
  const { kind, text, onDuplicate } = request.data;
  const supabase = await createClient();
  const context = await loadContext(supabase);
  if (!context) {
    return { error: "Could not save the rows. Try again.", counts: null };
  }

  const planned = planCustomerImport(kind, text, onDuplicate, context);
  const rows = importPayload(planned);
  if (rows.length === 0) {
    return {
      error: "No rows to save. Fix the rows marked in red.",
      counts: null,
    };
  }

  const { error } = await supabase.rpc(
    kind === "companies" ? "import_companies" : "import_contacts",
    { import_rows: rows },
  );
  if (error?.code === UNIQUE_VIOLATION) {
    return {
      error: "Someone added one of these just now. Check the rows again.",
      counts: null,
    };
  }
  if (error) {
    console.error("Could not import customers", error);
    return {
      error: "Could not save the rows. Nothing was saved.",
      counts: null,
    };
  }

  revalidatePath("/customers");
  return { error: null, counts: countActions(planned.plan.rows) };
}
