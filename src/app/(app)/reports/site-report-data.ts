import { z } from "zod";
import { shiftMonth } from "@/lib/domain/calendar-grid";
import { OT_STATUSES } from "@/lib/domain/ot-claim";
import { SITE_ACTIVITIES } from "@/lib/domain/site-log";
import {
  buildSiteMonthlyReport,
  type SiteMonthlyReport,
} from "@/lib/domain/site-monthly-report";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

const mofInfo = z.object({ mof_no: z.string(), project_name: z.string() });

const logRows = z.array(
  z.object({
    visited_on: z.string(),
    activity: z.enum(SITE_ACTIVITIES),
    notes: z.string().nullable(),
    handover_signed: z.boolean(),
    mofs: mofInfo,
  }),
);

const claimRows = z.array(
  z.object({
    work_date: z.string(),
    from_time: z.string(),
    to_time: z.string(),
    hours: z.coerce.number(),
    reason: z.string(),
    status: z.enum(OT_STATUSES),
    decided_by: z.string().nullable(),
    mofs: mofInfo,
  }),
);

/**
 * One Site Supervisor's month laid out as the monthly report form wants it: every site log line
 * and overtime claim of the month. The database limits what the caller may read.
 */
export async function loadSiteMonthlyReport(
  personId: string,
  name: string,
  month: CalendarDate,
  nameOf: ReadonlyMap<string, string>,
): Promise<SiteMonthlyReport> {
  const supabase = await createClient();
  const next = shiftMonth(month, 1);
  const [logs, claims] = await Promise.all([
    supabase
      .from("site_logs")
      .select(
        "visited_on, activity, notes, handover_signed, mofs!inner(mof_no, project_name)",
      )
      .eq("supervisor_id", personId)
      .gte("visited_on", month)
      .lt("visited_on", next),
    supabase
      .from("ot_claims")
      .select(
        "work_date, from_time, to_time, hours, reason, status, decided_by, mofs!inner(mof_no, project_name)",
      )
      .eq("profile_id", personId)
      .gte("work_date", month)
      .lt("work_date", next),
  ]);
  if (logs.error) {
    throw new Error(`Could not load the site log: ${logs.error.message}`);
  }
  if (claims.error) {
    throw new Error(`Could not load overtime: ${claims.error.message}`);
  }

  return buildSiteMonthlyReport({
    name,
    month,
    logs: logRows.parse(logs.data).map((row) => ({
      visitedOn: row.visited_on,
      mofNo: row.mofs.mof_no,
      projectName: row.mofs.project_name,
      activity: row.activity,
      notes: row.notes,
      handoverSigned: row.handover_signed,
    })),
    claims: claimRows.parse(claims.data).map((row) => ({
      workDate: row.work_date,
      mofNo: row.mofs.mof_no,
      projectName: row.mofs.project_name,
      reason: row.reason,
      // The database sends "20:00:00"; the report works in "20:00".
      fromTime: row.from_time.slice(0, 5),
      toTime: row.to_time.slice(0, 5),
      hours: row.hours,
      status: row.status,
      approvedBy: row.decided_by ? (nameOf.get(row.decided_by) ?? null) : null,
    })),
  });
}
