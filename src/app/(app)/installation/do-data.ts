import { z } from "zod";
import {
  type DeliveredEarlier,
  DO_UNITS,
  type DoLine,
} from "@/lib/domain/delivery-order";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const lineRows = z.array(
  z.object({
    position: z.number(),
    product: z.string(),
    code: z.string().nullable(),
    description: z.string().nullable(),
    batch: z.string().nullable(),
    unit: z.enum(DO_UNITS),
    qty: z.number(),
    covers: z.string().nullable(),
    delivery_orders: z.object({ job_id: z.string() }),
  }),
);

/** The items on each of the MOF's DOs, keyed by the delivery job, in printed order. */
export async function loadMofDoLines(
  supabase: Supabase,
  mofId: string,
): Promise<Map<string, DoLine[]>> {
  const { data, error } = await supabase
    .from("delivery_order_lines")
    .select(
      "position, product, code, description, batch, unit, qty, covers, delivery_orders!inner(job_id, mof_id)",
    )
    .eq("delivery_orders.mof_id", mofId)
    .order("position");
  if (error) throw new Error(`Could not load DO items: ${error.message}`);

  const byJob = new Map<string, DoLine[]>();
  for (const row of lineRows.parse(data)) {
    const lines = byJob.get(row.delivery_orders.job_id) ?? [];
    lines.push({
      product: row.product,
      code: row.code,
      description: row.description,
      batch: row.batch,
      covers: row.covers,
      unit: row.unit,
      qty: row.qty,
    });
    byJob.set(row.delivery_orders.job_id, lines);
  }
  return byJob;
}

/** The running no. "Issue DO no. now" would give next, as 4 digits. */
export async function loadNextDoNumber(supabase: Supabase): Promise<string> {
  const { data, error } = await supabase.rpc("next_do_number");
  if (error)
    throw new Error(`Could not load the next DO no.: ${error.message}`);
  return z.string().parse(data);
}

const earlierRows = z.array(
  z.object({ item: z.string(), unit: z.string(), qty: z.number() }),
);

/** What the MOF's other DOs already delivered, per item and unit (postponed deliveries left out). */
export async function loadDeliveredEarlier(
  supabase: Supabase,
  mofId: string,
  exceptJobId: string,
): Promise<DeliveredEarlier[]> {
  const { data, error } = await supabase.rpc("delivered_to_date", {
    p_mof_id: mofId,
    p_except_job_id: exceptJobId,
  });
  if (error) throw new Error(`Could not load earlier DOs: ${error.message}`);
  return earlierRows.parse(data);
}
