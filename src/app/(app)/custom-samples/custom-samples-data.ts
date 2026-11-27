import { z } from "zod";
import { createReadLinks } from "@/lib/storage/signed-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadTaskPeople } from "../tasks/task-data";
import { openLoan } from "./custom-sample-status";
import type { CustomSample } from "./custom-sample-types";

const date = z.iso.date();

const sampleRows = z.array(
  z.object({
    id: z.uuid(),
    code: z.string(),
    received_on: date,
    design_name: z.string(),
    design_no: z.string(),
    supplier: z.string().nullable(),
    size: z.string().nullable(),
    qty: z.number(),
    photo_path: z.string().nullable(),
    notes: z.string().nullable(),
    recorded_by: z.uuid(),
    given_on: date.nullable(),
    given_to: z.string().nullable(),
    gift_reason: z.string().nullable(),
    given_by: z.uuid().nullable(),
    custom_sample_loans: z.array(
      z.object({
        id: z.uuid(),
        salesperson_id: z.uuid(),
        customer: z.string(),
        project: z.string().nullable(),
        out_on: date,
        due_on: date,
        returned_marked_on: date.nullable(),
        back_on: date.nullable(),
        given_away: z.boolean(),
        created_at: z.string(),
      }),
    ),
  }),
);

/**
 * Every custom sample with its loans, oldest loan first. Photos get a short-lived link where the
 * service key exists; pass `withPhotos: false` when only the loans matter.
 */
export async function loadCustomSamples({
  withPhotos = true,
}: {
  withPhotos?: boolean;
} = {}): Promise<CustomSample[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_samples")
    .select(
      "id, code, received_on, design_name, design_no, supplier, size, qty, photo_path, notes, recorded_by, given_on, given_to, gift_reason, given_by, custom_sample_loans(id, salesperson_id, customer, project, out_on, due_on, returned_marked_on, back_on, given_away, created_at)",
    );
  if (error) {
    throw new Error(`Could not load custom samples: ${error.message}`);
  }

  const rows = sampleRows.parse(data);
  const admin = withPhotos ? createAdminClient() : null;
  const photoUrls = admin
    ? await createReadLinks(
        admin,
        rows.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
      )
    : new Map<string, string>();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    receivedOn: row.received_on,
    designName: row.design_name,
    designNo: row.design_no,
    supplier: row.supplier,
    size: row.size,
    qty: row.qty,
    photoPath: row.photo_path,
    photoUrl: row.photo_path ? (photoUrls.get(row.photo_path) ?? null) : null,
    notes: row.notes,
    recordedBy: row.recorded_by,
    givenOn: row.given_on,
    givenTo: row.given_to,
    giftReason: row.gift_reason,
    givenBy: row.given_by,
    loans: row.custom_sample_loans
      .toSorted((a, b) => a.created_at.localeCompare(b.created_at))
      .map((loan) => ({
        id: loan.id,
        salespersonId: loan.salesperson_id,
        customer: loan.customer,
        project: loan.project,
        outOn: loan.out_on,
        dueOn: loan.due_on,
        returnedMarkedOn: loan.returned_marked_on,
        backOn: loan.back_on,
        givenAway: loan.given_away,
      })),
  }));
}

const loanDaysSetting = z.object({
  value: z.object({ loanDays: z.number().int().min(1).max(365) }),
});

/** How many days a sample is lent for (settings key customSamples, 14 when unset). */
export async function loadLoanDays(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "customSamples")
    .maybeSingle();
  if (error) throw new Error(`Could not load the loan days: ${error.message}`);
  return data ? loanDaysSetting.parse(data).value.loanDays : 14;
}

/** The salespeople the MD may lend a sample to. Only the MD gets any: sellers borrow for themselves. */
export async function loadSellers(): Promise<{ id: string; name: string }[]> {
  const people = await loadTaskPeople();
  return people
    .filter((person) => ["sales", "bd", "director"].includes(person.jobRole))
    .map(({ id, name }) => ({ id, name }));
}

/**
 * WhatsApp numbers (People settings) of the people holding a sample now, for the office's
 * Remind button. Staff cannot read other profiles, so this uses the service key and is only
 * called for the office; without the key (a laptop) nobody has a number and the button opens
 * WhatsApp without one.
 */
export async function loadBorrowerWhatsApp(
  samples: readonly CustomSample[],
): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const borrowers = [
    ...new Set(
      samples.flatMap((sample) => openLoan(sample)?.salespersonId ?? []),
    ),
  ];
  if (!admin || borrowers.length === 0) return {};

  const { data, error } = await admin
    .from("profiles")
    .select("id, whatsapp")
    .in("id", borrowers);
  if (error)
    throw new Error(`Could not load WhatsApp numbers: ${error.message}`);
  return Object.fromEntries(
    z
      .array(z.object({ id: z.uuid(), whatsapp: z.string().nullable() }))
      .parse(data)
      .flatMap((row) => (row.whatsapp ? [[row.id, row.whatsapp]] : [])),
  );
}
