import { z } from "zod";
import {
  PICKUP_METHODS,
  type PickupMethod,
  SAMPLE_UNITS,
  type Sample,
  type SampleMove,
  type SampleUnit,
} from "@/lib/domain/samples";
import { createClient } from "@/lib/supabase/server";

export type SampleMoveRow = SampleMove & {
  movedOn: string;
  qtyBefore: number;
  takenBy: string | null;
  forWhom: string;
  /** The pickup form's running no. when the form took it out. */
  pickupNo: number | null;
  createdAt: string;
};

export type SampleRow = Omit<Sample, "moves"> & {
  brand: string;
  sku: string;
  name: string;
  spec: string;
  notes: string;
  updatedAt: string;
  updatedBy: string | null;
  moves: SampleMoveRow[];
};

const sampleRows = z.array(
  z.object({
    id: z.string(),
    product: z.string(),
    brand: z.string().nullable(),
    sku: z.string().nullable(),
    name: z.string().nullable(),
    qty: z.number(),
    unit: z.enum(SAMPLE_UNITS),
    spec: z.string().nullable(),
    notes: z.string().nullable(),
    updated_at: z.string(),
    updated_by: z.string().nullable(),
    sample_moves: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(["adjust", "out", "kept"]),
        qty: z.number(),
        qty_before: z.number(),
        moved_on: z.string(),
        taken_by: z.string().nullable(),
        for_whom: z.string().nullable(),
        back_on: z.string().nullable(),
        created_at: z.string(),
        sample_pickups: z.object({ running_no: z.number() }).nullable(),
      }),
    ),
  }),
);

/** Every sample with its history, by product, brand and SKU. */
export async function loadSamples(): Promise<SampleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("samples")
    .select(
      "id, product, brand, sku, name, qty, unit, spec, notes, updated_at, updated_by, sample_moves(id, kind, qty, qty_before, moved_on, taken_by, for_whom, back_on, created_at, sample_pickups(running_no))",
    );
  if (error) throw new Error(`Could not load samples: ${error.message}`);

  return sampleRows
    .parse(data)
    .map((row) => ({
      id: row.id,
      product: row.product,
      brand: row.brand ?? "",
      sku: row.sku ?? "",
      name: row.name ?? "",
      qty: row.qty,
      unit: row.unit,
      spec: row.spec ?? "",
      notes: row.notes ?? "",
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      moves: row.sample_moves
        .map((move) => ({
          id: move.id,
          kind: move.kind,
          qty: move.qty,
          qtyBefore: move.qty_before,
          movedOn: move.moved_on,
          backOn: move.back_on,
          takenBy: move.taken_by,
          forWhom: move.for_whom ?? "",
          pickupNo: move.sample_pickups?.running_no ?? null,
          createdAt: move.created_at,
        }))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    }))
    .sort(
      (a, b) =>
        a.product.localeCompare(b.product) ||
        a.brand.localeCompare(b.brand) ||
        a.sku.localeCompare(b.sku),
    );
}

/** How many sample SKUs there are, for the Stock segment label. */
export async function countSamples(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("samples")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`Could not count samples: ${error.message}`);
  return count ?? 0;
}

export type PickupLineRow = {
  position: number;
  sampleId: string | null;
  productName: string;
  spec: string | null;
  qty: number;
  unit: SampleUnit;
  remarks: string | null;
};

export type PickupFormRow = {
  id: string;
  runningNo: number;
  formDate: string;
  personInCharge: string;
  contact: string;
  method: PickupMethod;
  appointmentOn: string;
  driverContact: string | null;
  vehicleNo: string | null;
  address: string | null;
  takenBy: string | null;
  forWhom: string | null;
  pdfSavedAt: string | null;
  createdBy: string | null;
  lines: PickupLineRow[];
};

const pickupColumns =
  "id, running_no, form_date, person_in_charge, contact, method, appointment_on, driver_contact, vehicle_no, address, taken_by, for_whom, pdf_saved_at, created_by, sample_pickup_lines(position, sample_id, product_name, spec, qty, unit, remarks)";

const pickupRow = z.object({
  id: z.string(),
  running_no: z.number(),
  form_date: z.string(),
  person_in_charge: z.string(),
  contact: z.string(),
  method: z.enum(PICKUP_METHODS),
  appointment_on: z.string(),
  driver_contact: z.string().nullable(),
  vehicle_no: z.string().nullable(),
  address: z.string().nullable(),
  taken_by: z.string().nullable(),
  for_whom: z.string().nullable(),
  pdf_saved_at: z.string().nullable(),
  created_by: z.string().nullable(),
  sample_pickup_lines: z.array(
    z.object({
      position: z.number(),
      sample_id: z.string().nullable(),
      product_name: z.string(),
      spec: z.string().nullable(),
      qty: z.number(),
      unit: z.enum(SAMPLE_UNITS),
      remarks: z.string().nullable(),
    }),
  ),
});

function toPickupForm(row: z.infer<typeof pickupRow>): PickupFormRow {
  return {
    id: row.id,
    runningNo: row.running_no,
    formDate: row.form_date,
    personInCharge: row.person_in_charge,
    contact: row.contact,
    method: row.method,
    appointmentOn: row.appointment_on,
    driverContact: row.driver_contact,
    vehicleNo: row.vehicle_no,
    address: row.address,
    takenBy: row.taken_by,
    forWhom: row.for_whom,
    pdfSavedAt: row.pdf_saved_at,
    createdBy: row.created_by,
    lines: row.sample_pickup_lines
      .map((line) => ({
        position: line.position,
        sampleId: line.sample_id,
        productName: line.product_name,
        spec: line.spec,
        qty: line.qty,
        unit: line.unit,
        remarks: line.remarks,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

/** The newest pickup forms, for the list under the samples (the demo shows 30). */
export async function loadPickupForms(limit = 30): Promise<PickupFormRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_pickups")
    .select(pickupColumns)
    .order("running_no", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load pickup forms: ${error.message}`);
  return z.array(pickupRow).parse(data).map(toPickupForm);
}

/** One pickup form, or null when there is none with this id. */
export async function loadPickupForm(
  pickupId: string,
): Promise<PickupFormRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_pickups")
    .select(pickupColumns)
    .eq("id", pickupId)
    .maybeSingle();
  if (error)
    throw new Error(`Could not load the pickup form: ${error.message}`);
  return data ? toPickupForm(pickupRow.parse(data)) : null;
}

export type PickupSettings = {
  /** Digits with country code, or null when not set. */
  bestLinkWhatsapp: string | null;
  driveFolderUrl: string | null;
  /** The number the next saved form gets. */
  nextNo: number;
};

const settingsRow = z.object({
  best_link_whatsapp: z.string().nullable(),
  drive_folder_url: z.string().nullable(),
});

export async function loadPickupSettings(): Promise<PickupSettings> {
  const supabase = await createClient();
  const [settings, next] = await Promise.all([
    supabase
      .from("sample_pickup_settings")
      .select("best_link_whatsapp, drive_folder_url")
      .single(),
    supabase.rpc("next_sample_pickup_number"),
  ]);
  if (settings.error) {
    throw new Error(
      `Could not load pickup settings: ${settings.error.message}`,
    );
  }
  if (next.error) {
    throw new Error(`Could not read the next form no.: ${next.error.message}`);
  }
  const row = settingsRow.parse(settings.data);
  return {
    bestLinkWhatsapp: row.best_link_whatsapp,
    driveFolderUrl: row.drive_folder_url,
    nextNo: z.number().int().parse(next.data),
  };
}
