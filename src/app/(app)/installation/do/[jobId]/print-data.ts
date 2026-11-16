import { z } from "zod";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import type { DoLine } from "@/lib/domain/delivery-order";
import { createClient } from "@/lib/supabase/server";
import { loadMofDoLines } from "../../do-data";

export type PrintableDo = {
  mofId: string;
  mofNo: string;
  /** The 4-digit running no., or empty when none is issued. */
  runningNo: string;
  doDate: string;
  transporter: string;
  isFinal: boolean;
  remarks: string;
  billTo: { name: string; address: string };
  deliverTo: { name: string; address: string };
  clientPoNo: string;
  quoteNo: string;
  salesperson: string;
  sitePic: string;
  sitePicContact: string;
  officePic: string;
  paymentChecked: boolean;
  dosPreApproved: boolean;
  lines: DoLine[];
};

const orderRow = z.object({
  mof_id: z.string(),
  running_no: z.string().nullable(),
  transporter: z.string().nullable(),
  do_date: z.string().nullable(),
  is_final: z.boolean(),
  jobs: z.object({
    scheduled_on: z.string(),
    notes: z.string().nullable(),
  }),
  mofs: z.object({
    mof_no: z.string(),
    company_name: z.string(),
    project_name: z.string(),
    site_address: z.string().nullable(),
    loa_no: z.string().nullable(),
    quote_no: z.string().nullable(),
    salesperson_id: z.string(),
    site_contact_name: z.string().nullable(),
    site_contact_mobile: z.string().nullable(),
    office_pic_id: z.string().nullable(),
    payment_checked: z.boolean(),
    dos_pre_approved: z.boolean(),
    projects: z
      .object({
        contacts: z
          .object({ companies: z.object({ address: z.string().nullable() }) })
          .nullable(),
      })
      .nullable(),
  }),
});

/** What the printed DO shows for a delivery job, or null when the job has no DO. */
export async function loadPrintableDo(
  jobId: string,
): Promise<PrintableDo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("delivery_orders")
    .select(
      "mof_id, running_no, transporter, do_date, is_final, jobs!inner(scheduled_on, notes), mofs(mof_no, company_name, project_name, site_address, loa_no, quote_no, salesperson_id, site_contact_name, site_contact_mobile, office_pic_id, payment_checked, dos_pre_approved, projects(contacts(companies(address))))",
    )
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(`Could not load the DO: ${error.message}`);
  if (!data) return null;
  const order = orderRow.parse(data);
  const mof = order.mofs;

  const [team, lines] = await Promise.all([
    getTeamDirectory(),
    loadMofDoLines(supabase, order.mof_id),
  ]);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));

  return {
    mofId: order.mof_id,
    mofNo: mof.mof_no,
    runningNo: order.running_no ?? "",
    doDate: order.do_date ?? order.jobs.scheduled_on,
    transporter: order.transporter ?? "",
    isFinal: order.is_final,
    remarks: order.jobs.notes ?? "",
    billTo: {
      name: mof.company_name,
      address: mof.projects?.contacts?.companies.address ?? "",
    },
    deliverTo: { name: mof.project_name, address: mof.site_address ?? "" },
    clientPoNo: mof.loa_no ?? "",
    quoteNo: mof.quote_no ?? "",
    salesperson: nameOf.get(mof.salesperson_id) ?? "",
    sitePic: mof.site_contact_name ?? "",
    sitePicContact: mof.site_contact_mobile ?? "",
    officePic: mof.office_pic_id ? (nameOf.get(mof.office_pic_id) ?? "") : "",
    paymentChecked: mof.payment_checked,
    dosPreApproved: mof.dos_pre_approved,
    lines: lines.get(jobId) ?? [],
  };
}
