import { z } from "zod";
import { isManager, type JobRole } from "@/lib/auth/job-role";
import {
  BOOKING_PURPOSES,
  BOOKING_STATUSES,
  type BookingPurpose,
  type BookingStatus,
} from "@/lib/domain/site-booking";
import { createClient } from "@/lib/supabase/server";

export type CalendarBooking = {
  id: string;
  supervisorId: string;
  requestedBy: string;
  purpose: BookingPurpose;
  visitOn: string;
  /** HH:MM. */
  startTime: string;
  /** The pipeline project's name, or the site typed in. */
  siteLabel: string;
  notes: string;
  status: BookingStatus;
  declineReason: string;
};

const bookingRows = z.array(
  z.object({
    id: z.string(),
    supervisor_id: z.string(),
    requested_by: z.string(),
    purpose: z.enum(BOOKING_PURPOSES),
    visit_on: z.string(),
    start_time: z.string(),
    site: z.string().nullable(),
    notes: z.string().nullable(),
    status: z.enum(BOOKING_STATUSES),
    decline_reason: z.string().nullable(),
    projects: z.object({ name: z.string() }).nullable(),
  }),
);

/**
 * Bookings on any day from `from` to `to`, earliest first. `supervisorId` limits the list
 * to one Site Supervisor's own bookings.
 */
export async function loadCalendarBookings(
  from: string,
  to: string,
  supervisorId: string | null,
): Promise<CalendarBooking[]> {
  const supabase = await createClient();
  let query = supabase
    .from("site_bookings")
    .select(
      "id, supervisor_id, requested_by, purpose, visit_on, start_time, site, notes, status, decline_reason, projects(name)",
    )
    .gte("visit_on", from)
    .lte("visit_on", to)
    .order("visit_on")
    .order("start_time");
  if (supervisorId) query = query.eq("supervisor_id", supervisorId);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return bookingRows.parse(data).map((row) => ({
    id: row.id,
    supervisorId: row.supervisor_id,
    requestedBy: row.requested_by,
    purpose: row.purpose,
    visitOn: row.visit_on,
    startTime: row.start_time.slice(0, 5),
    siteLabel: row.projects?.name ?? row.site ?? "",
    notes: row.notes ?? "",
    status: row.status,
    declineReason: row.decline_reason ?? "",
  }));
}

const supervisorRows = z.array(
  z.object({ id: z.uuid(), full_name: z.string().nullable() }),
);

/** The Site Supervisors who can be booked. Staff cannot read profiles, so this goes through site_supervisors(). */
export async function loadSiteSupervisors(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("site_supervisors");
  if (error) {
    throw new Error(`Could not load site supervisors: ${error.message}`);
  }
  return supervisorRows
    .parse(data)
    .map((row) => ({ id: row.id, name: row.full_name ?? "Unnamed" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const projectRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    pic_id: z.string(),
    support_id: z.string().nullable(),
    contacts: z.object({ companies: z.object({ name: z.string() }) }),
  }),
);

export type BookableProject = { id: string; label: string };

/** The projects a person can book a supervisor for: their own, or all of them for a manager. */
export async function loadBookableProjects(me: {
  id: string;
  jobRole: JobRole;
}): Promise<BookableProject[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("id, name, pic_id, support_id, contacts(companies(name))")
    .neq("stage", "lost")
    .order("name");
  if (!isManager(me.jobRole)) {
    query = query.or(`pic_id.eq.${me.id},support_id.eq.${me.id}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return projectRows.parse(data).map((row) => ({
    id: row.id,
    label: `${row.name} · ${row.contacts.companies.name}`,
  }));
}

const pendingRows = z.array(z.object({ visit_on: z.string() }));

/** The days of a supervisor's bookings still waiting for an answer, earliest first. */
export async function loadPendingBookingDays(
  supervisorId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_bookings")
    .select("visit_on")
    .eq("supervisor_id", supervisorId)
    .eq("status", "requested")
    .order("visit_on");
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return pendingRows.parse(data).map((row) => row.visit_on);
}
