import { z } from "zod";
import { missingDeliveryChecks } from "@/lib/domain/delivery-status";
import { createClient } from "@/lib/supabase/server";
import type { MofOption } from "./add-job-dialog";

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    company_name: z.string(),
    project_name: z.string(),
    installer_name: z.string().nullable(),
    payment_checked: z.boolean(),
    dos_pre_approved: z.boolean(),
  }),
);

/** The MOFs a job can still be scheduled for: not closed or cancelled, newest first. */
export async function loadMofOptions(): Promise<MofOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select(
      "id, mof_no, company_name, project_name, installer_name, payment_checked, dos_pre_approved",
    )
    .not("stage", "in", "(closed,cancelled)")
    .order("mof_no", { ascending: false });
  if (error) throw new Error(`Could not load MOFs: ${error.message}`);
  return mofRows.parse(data).map((row) => ({
    id: row.id,
    mofNo: row.mof_no,
    label: `${row.mof_no} · ${row.company_name} · ${row.project_name}`,
    installer: row.installer_name ?? "",
    missingChecks: missingDeliveryChecks({
      paymentChecked: row.payment_checked,
      dosPreApproved: row.dos_pre_approved,
    }),
  }));
}
