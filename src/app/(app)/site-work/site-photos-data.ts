import { z } from "zod";
import {
  SHOOT_KINDS,
  SHOOT_STATUSES,
  type ShootKind,
  type ShootStatus,
} from "@/lib/domain/site-photos";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type ShootRequest = {
  id: string;
  mofId: string;
  mofNo: string;
  projectName: string;
  kind: ShootKind;
  dueOn: CalendarDate;
  bestOn: CalendarDate | null;
  supervisorId: string | null;
  note: string;
  status: ShootStatus;
  doneOn: CalendarDate | null;
  doneById: string | null;
  createdById: string;
  createdOn: CalendarDate;
};

const requestRows = z.array(
  z.object({
    id: z.string(),
    mof_id: z.string(),
    kind: z.enum(SHOOT_KINDS),
    due_on: z.iso.date(),
    best_on: z.iso.date().nullable(),
    supervisor_id: z.string().nullable(),
    note: z.string().nullable(),
    status: z.enum(SHOOT_STATUSES),
    done_at: z.string().nullable(),
    done_by: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
  }),
);

/** Requests still open first, then the newest; cancelled ones are not shown. */
export async function loadShootRequests(): Promise<ShootRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shoot_requests")
    .select(
      "id, mof_id, kind, due_on, best_on, supervisor_id, note, status, done_at, done_by, created_by, created_at, mofs(mof_no, project_name)",
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the shooting requests: ${error.message}`);
  }
  return requestRows
    .parse(data)
    .map((row) => ({
      id: row.id,
      mofId: row.mof_id,
      mofNo: row.mofs.mof_no,
      projectName: row.mofs.project_name,
      kind: row.kind,
      dueOn: row.due_on,
      bestOn: row.best_on,
      supervisorId: row.supervisor_id,
      note: row.note ?? "",
      status: row.status,
      doneOn: row.done_at ? todayMyt(new Date(row.done_at)) : null,
      doneById: row.done_by,
      createdById: row.created_by,
      createdOn: todayMyt(new Date(row.created_at)),
    }))
    .sort(
      (a, b) =>
        Number(a.status === "done") - Number(b.status === "done") ||
        b.createdOn.localeCompare(a.createdOn),
    );
}

export type PhotoLog = {
  id: string;
  activity: "shooting" | "handover";
  visitedOn: CalendarDate;
  supervisorId: string;
  mofId: string | null;
  mofNo: string | null;
  /** The MOF's project, or the site typed in for a new site. */
  siteLabel: string;
  details: string;
  toId: string | null;
  postedOn: CalendarDate | null;
  savedById: string | null;
  savedOn: CalendarDate | null;
  driveLink: string | null;
};

const photoRows = z.array(
  z.object({
    id: z.string(),
    activity: z.enum(["shooting", "handover"]),
    visited_on: z.iso.date(),
    supervisor_id: z.string(),
    mof_id: z.string().nullable(),
    site_name: z.string().nullable(),
    notes: z.string().nullable(),
    photos_to: z.string().nullable(),
    photos_posted_on: z.iso.date().nullable(),
    photos_saved_by: z.string().nullable(),
    photos_saved_at: z.string().nullable(),
    drive_link: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }).nullable(),
  }),
);

/** Every shooting and handover visit, the ones not yet in Drive first, then newest day first. */
export async function loadPhotoLogs(): Promise<PhotoLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_logs")
    .select(
      "id, activity, visited_on, supervisor_id, mof_id, site_name, notes, photos_to, photos_posted_on, photos_saved_by, photos_saved_at, drive_link, mofs(mof_no, project_name)",
    )
    .in("activity", ["shooting", "handover"])
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the photos: ${error.message}`);
  return photoRows
    .parse(data)
    .map((row) => ({
      id: row.id,
      activity: row.activity,
      visitedOn: row.visited_on,
      supervisorId: row.supervisor_id,
      mofId: row.mof_id,
      mofNo: row.mofs?.mof_no ?? null,
      siteLabel: row.mofs?.project_name ?? row.site_name ?? "",
      details: row.notes ?? "",
      toId: row.photos_to,
      postedOn: row.photos_posted_on,
      savedById: row.photos_saved_by,
      savedOn: row.photos_saved_at
        ? todayMyt(new Date(row.photos_saved_at))
        : null,
      driveLink: row.drive_link,
    }))
    .sort(
      (a, b) =>
        Number(a.savedOn !== null) - Number(b.savedOn !== null) ||
        b.visitedOn.localeCompare(a.visitedOn),
    );
}
