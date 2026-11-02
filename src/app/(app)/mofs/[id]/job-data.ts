import { z } from "zod";
import { JOB_STATUSES, JOB_TYPES } from "@/lib/domain/delivery-status";
import type { createClient } from "@/lib/supabase/server";
import type { JobRow } from "../../installation/job-form";

const jobRows = z.array(
  z.object({
    id: z.string(),
    job_type: z.enum(JOB_TYPES),
    status: z.enum(JOB_STATUSES),
    scheduled_on: z.string(),
    ends_on: z.string(),
    start_time: z.string().nullable(),
    installer: z.string().nullable(),
    site_supervisor_id: z.string().nullable(),
    notes: z.string().nullable(),
  }),
);

const orderRows = z.array(
  z.object({
    job_id: z.string(),
    running_no: z.string().nullable(),
    transporter: z.string().nullable(),
    delivered_on: z.string().nullable(),
    items: z.string().nullable(),
    is_final: z.boolean(),
    signed_returned: z.boolean(),
  }),
);

/** The MOF's jobs, earliest first, each delivery with its DO. */
export async function loadJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mofId: string,
): Promise<JobRow[]> {
  const [jobsResult, ordersResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, job_type, status, scheduled_on, ends_on, start_time, installer, site_supervisor_id, notes",
      )
      .eq("mof_id", mofId)
      .order("scheduled_on"),
    supabase
      .from("delivery_orders")
      .select(
        "job_id, running_no, transporter, delivered_on, items, is_final, signed_returned",
      )
      .eq("mof_id", mofId),
  ]);
  if (jobsResult.error) {
    throw new Error(`Could not load jobs: ${jobsResult.error.message}`);
  }
  if (ordersResult.error) {
    throw new Error(`Could not load DOs: ${ordersResult.error.message}`);
  }

  const orders = new Map(
    orderRows.parse(ordersResult.data).map((order) => [order.job_id, order]),
  );
  return jobRows.parse(jobsResult.data).map((job) => {
    const order = orders.get(job.id);
    return {
      id: job.id,
      jobType: job.job_type,
      status: job.status,
      scheduledOn: job.scheduled_on,
      endsOn: job.ends_on,
      startTime: job.start_time?.slice(0, 5) ?? "",
      installer: job.installer ?? "",
      siteSupervisorId: job.site_supervisor_id ?? "",
      notes: job.notes ?? "",
      order: order
        ? {
            runningNo: order.running_no ?? "",
            transporter: order.transporter ?? "",
            deliveredOn: order.delivered_on ?? "",
            items: order.items ?? "",
            isFinal: order.is_final,
            signedReturned: order.signed_returned,
          }
        : null,
    };
  });
}
