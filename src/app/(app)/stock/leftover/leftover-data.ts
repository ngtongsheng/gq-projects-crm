import { z } from "zod";
import {
  LEFTOVER_CONDITIONS,
  LEFTOVER_DESTINATIONS,
  LEFTOVER_STATUSES,
  LEFTOVER_UNITS,
  type LeftoverCondition,
  type LeftoverDestination,
  type LeftoverStatus,
  type LeftoverUnit,
} from "@/lib/domain/leftover";
import { createClient } from "@/lib/supabase/server";

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
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
  }),
);

/** Leftover stock, items waiting for pickup first, then newest. One site when `mofId` is given. */
export async function loadLeftovers(mofId?: string): Promise<Leftover[]> {
  const supabase = await createClient();
  let query = supabase
    .from("leftovers")
    .select(
      "id, mof_id, item, qty, unit, condition, destination, status, note, credit_note_no, credit_note_amount, created_at, created_by, mofs(mof_no, project_name)",
    )
    .order("created_at", { ascending: false });
  if (mofId) query = query.eq("mof_id", mofId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load leftover stock: ${error.message}`);

  return rows
    .parse(data)
    .map((row) => ({
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
    }))
    .sort(
      (a, b) =>
        Number(b.status === "pending_pickup") -
        Number(a.status === "pending_pickup"),
    );
}
