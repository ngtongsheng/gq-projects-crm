import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AdditionalWorkAlert = {
  id: string;
  mofId: string;
  mofNo: string;
  projectName: string;
  voNo: string;
  description: string;
  qty: string;
  createdAt: string;
  createdBy: string | null;
};

const alertRows = z.array(
  z.object({
    id: z.string(),
    created_at: z.string(),
    created_by: z.string().nullable(),
    mof_variation_orders: z.object({
      vo_no: z.string(),
      description: z.string(),
      qty: z.string().nullable(),
      mofs: z.object({
        id: z.string(),
        mof_no: z.string(),
        project_name: z.string(),
      }),
    }),
  }),
);

/** The additional work this supervisor was told about and has not noted yet, oldest first. */
export async function loadOpenAdditionalWork(
  supervisorId: string,
): Promise<AdditionalWorkAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("additional_work_alerts")
    .select(
      "id, created_at, created_by, mof_variation_orders(vo_no, description, qty, mofs(id, mof_no, project_name))",
    )
    .eq("supervisor_id", supervisorId)
    .is("noted_at", null)
    .order("created_at");
  if (error) {
    throw new Error(`Could not load additional work: ${error.message}`);
  }
  return alertRows.parse(data).map((row) => ({
    id: row.id,
    mofId: row.mof_variation_orders.mofs.id,
    mofNo: row.mof_variation_orders.mofs.mof_no,
    projectName: row.mof_variation_orders.mofs.project_name,
    voNo: row.mof_variation_orders.vo_no,
    description: row.mof_variation_orders.description,
    qty: row.mof_variation_orders.qty ?? "",
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}
