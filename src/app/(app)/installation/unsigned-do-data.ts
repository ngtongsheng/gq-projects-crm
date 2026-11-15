import { z } from "zod";
import { deliveryOrderNumber } from "@/lib/domain/delivery-status";
import { createClient } from "@/lib/supabase/server";

export type UnsignedDo = {
  jobId: string;
  /** The full DO number, or empty when none was keyed in. */
  doNo: string;
  mofNo: string;
  projectName: string;
  deliveredOn: string;
  transporter: string;
};

const unsignedRows = z.array(
  z.object({
    running_no: z.string().nullable(),
    transporter: z.string().nullable(),
    delivered_on: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
    jobs: z.object({ id: z.string(), ends_on: z.string() }),
  }),
);

/**
 * Deliveries that are Done but whose signed DO has not come back, longest waiting first
 * (demo: "DOs not yet signed & returned"). A supervisor's own jobs are limited with
 * `supervisorId`; `installerId` narrows to one installer.
 */
export async function loadUnsignedDos(
  supervisorId: string | null,
  installerId?: string,
): Promise<UnsignedDo[]> {
  const supabase = await createClient();
  let query = supabase
    .from("delivery_orders")
    .select(
      "running_no, transporter, delivered_on, mofs(mof_no, project_name), jobs!inner(id, ends_on)",
    )
    .eq("signed_returned", false)
    .eq("jobs.status", "done");
  if (supervisorId) query = query.eq("jobs.site_supervisor_id", supervisorId);
  if (installerId) query = query.eq("jobs.installer_id", installerId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load DOs: ${error.message}`);
  return unsignedRows
    .parse(data)
    .map((row) => ({
      jobId: row.jobs.id,
      doNo: deliveryOrderNumber(row.mofs.mof_no, row.running_no) ?? "",
      mofNo: row.mofs.mof_no,
      projectName: row.mofs.project_name,
      deliveredOn: row.delivered_on ?? row.jobs.ends_on,
      transporter: row.transporter ?? "",
    }))
    .sort((a, b) => a.deliveredOn.localeCompare(b.deliveredOn));
}
