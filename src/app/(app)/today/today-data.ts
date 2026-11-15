import { z } from "zod";
import { BOOKING_PURPOSES, BOOKING_STATUSES } from "@/lib/domain/site-booking";
import {
  FOLLOW_UP_OWNERS,
  SITE_ACTIVITIES,
  type SiteActivity,
} from "@/lib/domain/site-log";
import type { PlanBooking } from "@/lib/domain/site-plan";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

/** A log this supervisor saved, as the Log work home lists and counts it. */
export type MyLog = {
  id: string;
  visitedOn: CalendarDate;
  activity: SiteActivity;
  mofId: string | null;
  /** The pipeline project: on the log for a new site, or the MOF's own. */
  projectId: string | null;
  siteName: string | null;
  /** MOF no. and project, or the typed-in site. */
  mofNo: string | null;
  siteLabel: string;
  installedPct: number | null;
  /** The first follow-up action the visit raised. */
  problem: string | null;
};

const logRows = z.array(
  z.object({
    id: z.string(),
    visited_on: z.iso.date(),
    activity: z.enum(SITE_ACTIVITIES),
    mof_id: z.string().nullable(),
    project_id: z.string().nullable(),
    site_name: z.string().nullable(),
    inst_pct: z.number().nullable(),
    mofs: z
      .object({
        mof_no: z.string(),
        project_name: z.string(),
        project_id: z.string().nullable(),
      })
      .nullable(),
    site_follow_ups: z.array(z.object({ action: z.string() })),
  }),
);

/** The supervisor's own logs from `from` to `to`, oldest first. */
export async function loadMyLogs(
  supervisorId: string,
  from: CalendarDate,
  to: CalendarDate,
): Promise<MyLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_logs")
    .select(
      "id, visited_on, activity, mof_id, project_id, site_name, inst_pct, mofs(mof_no, project_name, project_id), site_follow_ups(action)",
    )
    .eq("supervisor_id", supervisorId)
    .gte("visited_on", from)
    .lte("visited_on", to)
    .order("visited_on")
    .order("created_at");
  if (error) throw new Error(`Could not load your site log: ${error.message}`);
  return logRows.parse(data).map((row) => ({
    id: row.id,
    visitedOn: row.visited_on,
    activity: row.activity,
    mofId: row.mof_id,
    projectId: row.project_id ?? row.mofs?.project_id ?? null,
    siteName: row.site_name,
    mofNo: row.mofs?.mof_no ?? null,
    siteLabel: row.mofs?.project_name ?? row.site_name ?? "",
    installedPct: row.inst_pct,
    problem: row.site_follow_ups[0]?.action ?? null,
  }));
}

export type SiteOffDay = {
  id: string;
  kind: "office" | "other";
  startsOn: CalendarDate;
  endsOn: CalendarDate;
  note: string | null;
};

const siteOffRows = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(["office", "other"]),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
    note: z.string().nullable(),
  }),
);

/** The supervisor's office and other days that touch `from` to `to`. */
export async function loadMySiteOff(
  profileId: string,
  from: CalendarDate,
  to: CalendarDate,
): Promise<SiteOffDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_off")
    .select("id, kind, starts_on, ends_on, note")
    .eq("profile_id", profileId)
    .lte("starts_on", to)
    .gte("ends_on", from)
    .order("starts_on");
  if (error) throw new Error(`Could not load your days away: ${error.message}`);
  return siteOffRows.parse(data).map((row) => ({
    id: row.id,
    kind: row.kind,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    note: row.note,
  }));
}

const bookingRows = z.array(
  z.object({
    purpose: z.enum(BOOKING_PURPOSES),
    status: z.enum(BOOKING_STATUSES),
    visit_on: z.iso.date(),
    start_time: z.string(),
    project_id: z.string().nullable(),
    site: z.string().nullable(),
    notes: z.string().nullable(),
    projects: z.object({ name: z.string() }).nullable(),
  }),
);

/** The supervisor's bookings from `from` to `to`, with the project id the log is matched on. */
export async function loadMyBookings(
  supervisorId: string,
  from: CalendarDate,
  to: CalendarDate,
): Promise<PlanBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bookings")
    .select(
      "purpose, status, visit_on, start_time, project_id, site, notes, projects(name)",
    )
    .eq("supervisor_id", supervisorId)
    .gte("visit_on", from)
    .lte("visit_on", to);
  if (error) throw new Error(`Could not load your bookings: ${error.message}`);
  return bookingRows.parse(data).map((row) => ({
    purpose: row.purpose,
    status: row.status,
    visitOn: row.visit_on,
    startTime: row.start_time.slice(0, 5),
    projectId: row.project_id,
    siteLabel: row.projects?.name ?? row.site ?? "",
    notes: row.notes ?? "",
  }));
}

const openFollowUpRows = z.array(
  z.object({
    owner_group: z.enum(FOLLOW_UP_OWNERS),
    assignee_id: z.string().nullable(),
    due_on: z.iso.date().nullable(),
  }),
);

export type OpenFollowUp = {
  ownerGroup: (typeof FOLLOW_UP_OWNERS)[number];
  assigneeId: string | null;
  dueOn: CalendarDate | null;
};

/** Every open follow-up; the caller keeps the ones that are this person's to chase. */
export async function loadOpenFollowUps(): Promise<OpenFollowUp[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_follow_ups")
    .select("owner_group, assignee_id, due_on")
    .is("done_at", null);
  if (error) throw new Error(`Could not load follow-ups: ${error.message}`);
  return openFollowUpRows.parse(data).map((row) => ({
    ownerGroup: row.owner_group,
    assigneeId: row.assignee_id,
    dueOn: row.due_on,
  }));
}
