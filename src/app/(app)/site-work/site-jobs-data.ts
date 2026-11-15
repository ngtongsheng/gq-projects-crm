import { z } from "zod";
import {
  type DeliveryStatus,
  deliveryStatus,
  JOB_STATUSES,
  JOB_TYPES,
  type JobStatus,
  type JobType,
} from "@/lib/domain/delivery-status";
import {
  type InstalledLog,
  latestInstalled,
  needsFirstVisit,
  nextOnSite,
} from "@/lib/domain/site-jobs";
import { SITE_ACTIVITIES, type SiteActivity } from "@/lib/domain/site-log";
import { SITE_STAGES, type SiteStage } from "@/lib/domain/site-stage";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type SiteJob = {
  id: string;
  mofNo: string;
  projectName: string;
  companyName: string;
  salespersonId: string;
  siteStage: SiteStage;
  registeredOn: CalendarDate;
  installed: { pct: number; on: CalendarDate } | null;
  lastVisit: {
    visitedOn: CalendarDate;
    activity: SiteActivity;
    notes: string;
  } | null;
  delivery: { state: DeliveryStatus; label: string };
  openActions: number;
  next: {
    jobType: JobType;
    status: JobStatus;
    scheduledOn: CalendarDate;
    endsOn: CalendarDate;
    installer: string | null;
    supervisorId: string | null;
  } | null;
  /** A registered MOF with no visit since: the "new MOF" first-visit banner. */
  needsFirstVisit: boolean;
};

const mofRows = z.array(
  z.object({
    id: z.string(),
    mof_no: z.string(),
    project_name: z.string(),
    company_name: z.string(),
    salesperson_id: z.string(),
    project_id: z.string().nullable(),
    site_stage: z.enum(SITE_STAGES),
    created_at: z.string(),
    site_logs: z.array(
      z.object({
        visited_on: z.iso.date(),
        created_at: z.string(),
        activity: z.enum(SITE_ACTIVITIES),
        notes: z.string().nullable(),
        inst_pct: z.number().nullable(),
        site_follow_ups: z.array(z.object({ done_at: z.string().nullable() })),
      }),
    ),
    jobs: z.array(
      z.object({
        id: z.string(),
        job_type: z.enum(JOB_TYPES),
        status: z.enum(JOB_STATUSES),
        scheduled_on: z.iso.date(),
        ends_on: z.iso.date(),
        installer: z.string().nullable(),
        site_supervisor_id: z.string().nullable(),
      }),
    ),
    delivery_orders: z.array(
      z.object({ job_id: z.string(), is_final: z.boolean() }),
    ),
  }),
);

const newSiteVisits = z.array(
  z.object({ project_id: z.string(), visited_on: z.iso.date() }),
);

/** Orders that are not closed or cancelled, with where each job stands on site. */
export async function loadSiteJobs(): Promise<SiteJob[]> {
  const supabase = await createClient();
  const [mofs, earlier] = await Promise.all([
    supabase
      .from("mofs")
      .select(
        "id, mof_no, project_name, company_name, salesperson_id, project_id, site_stage, created_at, site_logs(visited_on, created_at, activity, notes, inst_pct, site_follow_ups(done_at)), jobs(id, job_type, status, scheduled_on, ends_on, installer, site_supervisor_id), delivery_orders(job_id, is_final)",
      )
      .not("stage", "in", "(closed,cancelled)")
      .order("mof_no", { ascending: false }),
    // Visits to the project logged as a new site, before it had an MOF.
    supabase
      .from("site_logs")
      .select("project_id, visited_on")
      .is("mof_id", null)
      .not("project_id", "is", null),
  ]);
  if (mofs.error) {
    throw new Error(`Could not load the jobs: ${mofs.error.message}`);
  }
  if (earlier.error) {
    throw new Error(`Could not load the visits: ${earlier.error.message}`);
  }

  const today = todayMyt();
  const newSiteDays = new Map<string, CalendarDate[]>();
  for (const visit of newSiteVisits.parse(earlier.data)) {
    newSiteDays.set(visit.project_id, [
      ...(newSiteDays.get(visit.project_id) ?? []),
      visit.visited_on,
    ]);
  }

  return mofRows.parse(mofs.data).map((row) => {
    const logs = row.site_logs.map((log) => ({
      visitedOn: log.visited_on,
      createdAt: log.created_at,
      activity: log.activity,
      notes: log.notes ?? "",
      instPct: log.inst_pct,
      open: log.site_follow_ups.filter((followUp) => followUp.done_at === null)
        .length,
    }));
    const installLogs: InstalledLog[] = logs;
    const last = [...logs].sort(
      (a, b) =>
        b.visitedOn.localeCompare(a.visitedOn) ||
        b.createdAt.localeCompare(a.createdAt),
    )[0];
    const finalDo = new Set(
      row.delivery_orders
        .filter((order) => order.is_final)
        .map((order) => order.job_id),
    );
    const next = nextOnSite(
      row.jobs.map((job) => ({
        jobType: job.job_type,
        status: job.status,
        scheduledOn: job.scheduled_on,
        endsOn: job.ends_on,
        installer: job.installer,
        supervisorId: job.site_supervisor_id,
      })),
      today,
    );
    const registeredOn = todayMyt(new Date(row.created_at));
    const visitDays = [
      ...logs.map((log) => log.visitedOn),
      ...(row.project_id ? (newSiteDays.get(row.project_id) ?? []) : []),
    ];
    return {
      id: row.id,
      mofNo: row.mof_no,
      projectName: row.project_name,
      companyName: row.company_name,
      salespersonId: row.salesperson_id,
      siteStage: row.site_stage,
      registeredOn,
      installed: latestInstalled(installLogs),
      lastVisit: last
        ? {
            visitedOn: last.visitedOn,
            activity: last.activity,
            notes: last.notes,
          }
        : null,
      delivery: deliveryStatus(
        row.jobs
          .filter((job) => job.job_type === "delivery")
          .map((job) => ({ status: job.status, isFinal: finalDo.has(job.id) })),
      ),
      openActions: logs.reduce((total, log) => total + log.open, 0),
      next,
      needsFirstVisit: needsFirstVisit(
        { siteStage: row.site_stage, registeredOn },
        visitDays,
      ),
    };
  });
}
