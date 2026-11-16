import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { positionAmongMofDos } from "@/lib/domain/delivery-order";
import {
  type DeliveryStatus,
  deliveryOrderNumber,
  deliveryStatus,
  JOB_STATUSES,
  type JobStatus,
} from "@/lib/domain/delivery-status";
import { createClient } from "@/lib/supabase/server";
import { loadNextDoNumber } from "../installation/do-data";
import { JobScope } from "./schemas";

export type DeliveryLogRow = {
  jobId: string;
  mofId: string;
  mofNo: string;
  /** The full DO no., or empty when none is issued yet. */
  doNo: string;
  runningNo: string;
  companyName: string;
  projectName: string;
  doDate: string;
  jobStatus: JobStatus;
  transporter: string;
  scope: JobScope;
  isFinal: boolean;
  passedToSupplier: boolean;
  signedReturned: boolean;
  items: string;
  remarks: string;
  /** "DO 2 of 3" when the MOF has several numbered DOs. */
  position: string;
  delivery: { state: DeliveryStatus; label: string };
};

export type CancelledDoNumber = {
  /** MOF no. followed by the running no. */
  doNo: string;
  cancelledOn: string;
  cancelledBy: string;
};

const logRows = z.array(
  z.object({
    job_id: z.string(),
    mof_id: z.string(),
    running_no: z.string().nullable(),
    transporter: z.string().nullable(),
    do_date: z.string().nullable(),
    items: z.string().nullable(),
    is_final: z.boolean(),
    passed_to_supplier: z.boolean(),
    signed_returned: z.boolean(),
    jobs: z.object({
      status: z.enum(JOB_STATUSES),
      scheduled_on: z.string(),
      notes: z.string().nullable(),
    }),
    // Null when the person may read the DO but not its MOF (RLS hides the embedded row).
    mofs: z
      .object({
        mof_no: z.string(),
        company_name: z.string(),
        project_name: z.string(),
        scope: JobScope,
      })
      .nullable(),
  }),
);

/** The DOs whose MOF the person may read; the rest are left out of the log. */
export function readableDeliveryOrders(data: unknown) {
  return logRows
    .parse(data)
    .flatMap(({ mofs, ...order }) => (mofs ? [{ ...order, mofs }] : []));
}

const cancelledRows = z.array(
  z.object({
    running_no: z.string(),
    cancelled_at: z.string(),
    cancelled_by: z.string().nullable(),
    mofs: z.object({ mof_no: z.string() }).nullable(),
  }),
);

/**
 * Every delivery's DO, newest first, with the numbers cancelled for good and the number the
 * next DO gets. Callers narrow the rows to the MOFs the person may see.
 */
export async function loadDeliveryLog(): Promise<{
  rows: DeliveryLogRow[];
  cancelled: CancelledDoNumber[];
  nextNo: string;
}> {
  const supabase = await createClient();
  const [ordersResult, cancelledResult, team, nextNo] = await Promise.all([
    supabase
      .from("delivery_orders")
      .select(
        "job_id, mof_id, running_no, transporter, do_date, items, is_final, passed_to_supplier, signed_returned, jobs!inner(status, scheduled_on, notes), mofs(mof_no, company_name, project_name, scope)",
      ),
    supabase
      .from("cancelled_delivery_order_numbers")
      .select("running_no, cancelled_at, cancelled_by, mofs(mof_no)")
      .order("cancelled_at", { ascending: false }),
    getTeamDirectory(),
    loadNextDoNumber(supabase),
  ]);
  if (ordersResult.error) {
    throw new Error(`Could not load the DOs: ${ordersResult.error.message}`);
  }
  if (cancelledResult.error) {
    throw new Error(
      `Could not load cancelled DO numbers: ${cancelledResult.error.message}`,
    );
  }
  const orders = readableDeliveryOrders(ordersResult.data);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  const stateByMof = new Map<
    string,
    { state: DeliveryStatus; label: string }
  >();
  for (const mofId of new Set(orders.map((order) => order.mof_id))) {
    const { state, label } = deliveryStatus(
      orders
        .filter((order) => order.mof_id === mofId)
        .map((order) => ({
          status: order.jobs.status,
          isFinal: order.is_final,
        })),
    );
    stateByMof.set(mofId, { state, label });
  }
  const positions = positionAmongMofDos(
    orders.map((order) => ({
      jobId: order.job_id,
      mofId: order.mof_id,
      runningNo: order.running_no,
    })),
  );

  const rows = orders
    .map((order): DeliveryLogRow => {
      const place = positions.get(order.job_id);
      return {
        jobId: order.job_id,
        mofId: order.mof_id,
        mofNo: order.mofs.mof_no,
        doNo: deliveryOrderNumber(order.mofs.mof_no, order.running_no) ?? "",
        runningNo: order.running_no ?? "",
        companyName: order.mofs.company_name,
        projectName: order.mofs.project_name,
        doDate: order.do_date ?? order.jobs.scheduled_on,
        jobStatus: order.jobs.status,
        transporter: order.transporter ?? "",
        scope: order.mofs.scope,
        isFinal: order.is_final,
        passedToSupplier: order.passed_to_supplier,
        signedReturned: order.signed_returned,
        items: order.items ?? "",
        remarks: order.jobs.notes ?? "",
        position:
          place && place.total > 1 ? `DO ${place.nth} of ${place.total}` : "",
        delivery: stateByMof.get(order.mof_id) ?? {
          state: "not_delivered",
          label: "Not delivered",
        },
      };
    })
    .sort(
      (a, b) =>
        b.doDate.localeCompare(a.doDate) ||
        b.runningNo.localeCompare(a.runningNo),
    );

  const cancelled = cancelledRows
    .parse(cancelledResult.data)
    .flatMap(({ mofs, ...row }) =>
      mofs
        ? [
            {
              doNo: `${mofs.mof_no}${row.running_no}`,
              cancelledOn: row.cancelled_at,
              cancelledBy: row.cancelled_by
                ? (nameOf.get(row.cancelled_by) ?? "")
                : "",
            },
          ]
        : [],
    );

  return { rows, cancelled, nextNo };
}
