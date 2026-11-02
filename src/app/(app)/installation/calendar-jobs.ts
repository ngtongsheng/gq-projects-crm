import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  JOB_COLUMNS,
  jobRows,
  ORDER_COLUMNS,
  orderRows,
  toJobRow,
} from "../mofs/[id]/job-data";
import type { JobRow } from "./job-form";

const calendarJobRows = z.array(
  jobRows.element.extend({
    mof_id: z.string(),
    mofs: z.object({
      mof_no: z.string(),
      company_name: z.string(),
      project_name: z.string(),
      installer_name: z.string().nullable(),
      payment_checked: z.boolean(),
      dos_pre_approved: z.boolean(),
    }),
  }),
);

export type CalendarJob = JobRow & {
  mofId: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  /** The installer named on the MOF, offered when the job is edited. */
  mofInstaller: string;
  paymentChecked: boolean;
  dosPreApproved: boolean;
};

/**
 * Jobs that run on any day from `from` to `to`, earliest first, each delivery with its DO.
 * `supervisorId` limits the list to one Site Supervisor's own jobs.
 */
export async function loadCalendarJobs(
  from: string,
  to: string,
  supervisorId: string | null,
): Promise<CalendarJob[]> {
  const supabase = await createClient();
  let query = supabase
    .from("jobs")
    .select(
      `${JOB_COLUMNS}, mof_id, mofs(mof_no, company_name, project_name, installer_name, payment_checked, dos_pre_approved)`,
    )
    .lte("scheduled_on", to)
    .gte("ends_on", from)
    .order("scheduled_on")
    .order("start_time", { nullsFirst: false });
  if (supervisorId) query = query.eq("site_supervisor_id", supervisorId);

  const jobsResult = await query;
  if (jobsResult.error) {
    throw new Error(`Could not load jobs: ${jobsResult.error.message}`);
  }
  const jobs = calendarJobRows.parse(jobsResult.data);

  const deliveryIds = jobs
    .filter((job) => job.job_type === "delivery")
    .map((job) => job.id);
  const orders = new Map<string, z.infer<typeof orderRows>[number]>();
  if (deliveryIds.length > 0) {
    const ordersResult = await supabase
      .from("delivery_orders")
      .select(ORDER_COLUMNS)
      .in("job_id", deliveryIds);
    if (ordersResult.error) {
      throw new Error(`Could not load DOs: ${ordersResult.error.message}`);
    }
    for (const order of orderRows.parse(ordersResult.data)) {
      orders.set(order.job_id, order);
    }
  }

  return jobs.map((job) => ({
    ...toJobRow(job, orders.get(job.id)),
    mofId: job.mof_id,
    mofNo: job.mofs.mof_no,
    companyName: job.mofs.company_name,
    projectName: job.mofs.project_name,
    mofInstaller: job.mofs.installer_name ?? "",
    paymentChecked: job.mofs.payment_checked,
    dosPreApproved: job.mofs.dos_pre_approved,
  }));
}
