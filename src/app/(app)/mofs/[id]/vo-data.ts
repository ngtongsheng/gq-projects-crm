import { z } from "zod";
import { SITE_STAGES } from "@/lib/domain/site-stage";
import type { createClient } from "@/lib/supabase/server";
import type { VariationOrderRow } from "./vo-sheet";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const voRows = z.array(
  z.object({
    id: z.string(),
    vo_no: z.string(),
    client_ref: z.string().nullable(),
    confirmed_on: z.string(),
    amount: z.number(),
    description: z.string(),
    qty: z.string().nullable(),
    needs_work: z.boolean(),
    additional_work_alerts: z.array(
      z.object({ supervisor_id: z.string(), noted_at: z.string().nullable() }),
    ),
    // Embedded one-to-one; absent unless asked for, null when the VO has no cost.
    mof_variation_order_costs: z.object({ cost: z.number() }).nullish(),
  }),
);

const siteStageRow = z.object({ site_stage: z.enum(SITE_STAGES) });

const COLUMNS =
  "id, vo_no, client_ref, confirmed_on, amount, description, qty, needs_work, additional_work_alerts(supervisor_id, noted_at)";

/** The MOF's VOs in the order they were confirmed, and whether the site marked the job completed. */
export async function loadVariationOrders(
  supabase: Supabase,
  mofId: string,
  withCost: boolean,
): Promise<{ vos: VariationOrderRow[]; jobCompleted: boolean }> {
  const [vosResult, stageResult] = await Promise.all([
    supabase
      .from("mof_variation_orders")
      .select(
        withCost ? `${COLUMNS}, mof_variation_order_costs(cost)` : COLUMNS,
      )
      .eq("mof_id", mofId)
      .order("confirmed_on")
      .order("vo_no"),
    supabase.from("mofs").select("site_stage").eq("id", mofId).single(),
  ]);
  if (vosResult.error) {
    throw new Error(
      `Could not load variation orders: ${vosResult.error.message}`,
    );
  }
  if (stageResult.error) {
    throw new Error(`Could not load site stage: ${stageResult.error.message}`);
  }
  const vos = voRows.parse(vosResult.data).map((row) => ({
    id: row.id,
    voNo: row.vo_no,
    clientRef: row.client_ref ?? "",
    confirmedOn: row.confirmed_on,
    amount: row.amount,
    description: row.description,
    qty: row.qty ?? "",
    needsWork: row.needs_work,
    cost: row.mof_variation_order_costs?.cost ?? null,
    alerts: row.additional_work_alerts.map((alert) => ({
      supervisorId: alert.supervisor_id,
      notedAt: alert.noted_at,
    })),
  }));
  return {
    vos,
    jobCompleted:
      siteStageRow.parse(stageResult.data).site_stage === "completed",
  };
}
