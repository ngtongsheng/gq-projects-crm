import { z } from "zod";
import {
  guessLeftoverKeepReason,
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_KEEP_REASONS,
  LEFTOVER_RETURN_METHODS,
  LEFTOVER_STATUSES,
  LEFTOVER_UNITS,
  type LeftoverCondition,
  type LeftoverDestination,
  type LeftoverKeepReason,
  type LeftoverReturnMethod,
  type LeftoverStatus,
  type LeftoverUnit,
  leftoverAvailable,
} from "@/lib/domain/leftover";
import { createClient } from "@/lib/supabase/server";

/** Stock used for another project (the demo's `sold`). */
export type LeftoverUse = {
  id: string;
  projectName: string;
  /** The salesperson in charge of that project. */
  salespersonId: string | null;
  qty: number;
  usedOn: string;
  note: string;
};

export type Leftover = {
  id: string;
  mofId: string;
  mofNo: string;
  projectName: string;
  item: string;
  qty: number;
  unit: LeftoverUnit;
  condition: LeftoverCondition;
  destination: LeftoverDestination;
  status: LeftoverStatus;
  note: string;
  creditNoteNo: string | null;
  creditNoteAmount: number | null;
  recordedOn: string;
  recordedBy: string | null;
  returnMethod: LeftoverReturnMethod | null;
  transportBy: string | null;
  transportOn: string | null;
  transportTo: string | null;
  transportCost: number | null;
  supplier: string | null;
  /** Why GQ keeps it: a guess from the name for rows saved before the question existed. Null for stock going back. */
  keepReason: LeftoverKeepReason | null;
  orderedWrongBy: string | null;
  whatsappSentAt: string | null;
  collectedAt: string | null;
  collectedBy: string | null;
  collectedTo: string | null;
  /** When it reached the supplier or Best Link; the recording date for rows saved before it was kept. */
  receivedAt: string;
  receivedBy: string | null;
  uses: LeftoverUse[];
  /** What is still at Best Link after the uses. */
  available: number;
};

const rows = z.array(
  z.object({
    id: z.string(),
    mof_id: z.string(),
    item: z.string(),
    qty: z.number(),
    unit: z.enum(LEFTOVER_UNITS),
    condition: z.enum(LEFTOVER_CONDITIONS),
    destination: z.enum(LEFTOVER_DESTINATIONS),
    status: z.enum(LEFTOVER_STATUSES),
    note: z.string().nullable(),
    credit_note_no: z.string().nullable(),
    credit_note_amount: z.number().nullable(),
    created_at: z.string(),
    created_by: z.string().nullable(),
    return_method: z.enum(LEFTOVER_RETURN_METHODS).nullable(),
    transport_by: z.string().nullable(),
    transport_on: z.string().nullable(),
    transport_to: z.string().nullable(),
    transport_cost: z.number().nullable(),
    supplier: z.string().nullable(),
    keep_reason: z.enum(LEFTOVER_KEEP_REASONS).nullable(),
    ordered_wrong_by: z.string().nullable(),
    whatsapp_sent_at: z.string().nullable(),
    collected_at: z.string().nullable(),
    collected_by: z.string().nullable(),
    collected_to: z.string().nullable(),
    received_at: z.string().nullable(),
    received_by: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
    leftover_allocations: z.array(
      z.object({
        id: z.string(),
        qty: z.number(),
        allocated_on: z.string(),
        note: z.string().nullable(),
        projects: z
          .object({ name: z.string(), pic_id: z.string().nullable() })
          .nullable(),
      }),
    ),
  }),
);

/**
 * Leftover stock, items waiting for pickup first, then newest. One site when `mofId` is given. A row whose MOF
 * the person cannot read is left out (`!inner`), as the Sales Director cannot read every MOF.
 */
export async function loadLeftovers(mofId?: string): Promise<Leftover[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leftovers")
    .select(
      "id, mof_id, item, qty, unit, condition, destination, status, note, credit_note_no, credit_note_amount, created_at, created_by, return_method, transport_by, transport_on, transport_to, transport_cost, supplier, keep_reason, ordered_wrong_by, whatsapp_sent_at, collected_at, collected_by, collected_to, received_at, received_by, mofs!inner(mof_no, project_name), leftover_allocations(id, qty, allocated_on, note, projects(name, pic_id))",
    )
    .order("created_at", { ascending: false });
  if (mofId) query = query.eq("mof_id", mofId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load leftover stock: ${error.message}`);

  return rows
    .parse(data)
    .map((row) => {
      const uses = row.leftover_allocations
        .map((use) => ({
          id: use.id,
          projectName: use.projects?.name ?? "A project",
          salespersonId: use.projects?.pic_id ?? null,
          qty: use.qty,
          usedOn: use.allocated_on,
          note: use.note ?? "",
        }))
        .sort((a, b) => a.usedOn.localeCompare(b.usedOn));
      return {
        id: row.id,
        mofId: row.mof_id,
        mofNo: row.mofs.mof_no,
        projectName: row.mofs.project_name,
        item: row.item,
        qty: row.qty,
        unit: row.unit,
        condition: row.condition,
        destination: row.destination,
        status: row.status,
        note: row.note ?? "",
        creditNoteNo: row.credit_note_no,
        creditNoteAmount: row.credit_note_amount,
        recordedOn: row.created_at,
        recordedBy: row.created_by,
        returnMethod: row.return_method,
        transportBy: row.transport_by,
        transportOn: row.transport_on,
        transportTo: row.transport_to,
        transportCost: row.transport_cost,
        supplier: row.supplier,
        keepReason:
          row.destination === "gq"
            ? (row.keep_reason ?? guessLeftoverKeepReason(row.item))
            : null,
        orderedWrongBy: row.ordered_wrong_by,
        whatsappSentAt: row.whatsapp_sent_at,
        collectedAt: row.collected_at,
        collectedBy: row.collected_by,
        collectedTo: row.collected_to,
        receivedAt: row.received_at ?? row.created_at,
        receivedBy: row.received_by,
        uses,
        available: leftoverAvailable(row.qty, uses),
      };
    })
    .sort(
      (a, b) =>
        Number(b.status === "pending_pickup") -
        Number(a.status === "pending_pickup"),
    );
}
