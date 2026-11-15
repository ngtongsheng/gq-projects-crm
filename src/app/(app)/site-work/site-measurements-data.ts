import { z } from "zod";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type SiteMeasurement = {
  id: string;
  visitedOn: CalendarDate;
  supervisorId: string;
  mofId: string | null;
  mofNo: string | null;
  /** The MOF's project, or the site typed in for a new site. */
  siteLabel: string;
  details: string;
  toId: string | null;
  sentOn: CalendarDate | null;
  received: boolean;
  receivedOn: CalendarDate | null;
};

const rows = z.array(
  z.object({
    id: z.string(),
    visited_on: z.iso.date(),
    supervisor_id: z.string(),
    mof_id: z.string().nullable(),
    site_name: z.string().nullable(),
    notes: z.string().nullable(),
    measurement_to: z.string().nullable(),
    measurement_sent_on: z.iso.date().nullable(),
    measurement_received: z.boolean(),
    measurement_received_at: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }).nullable(),
  }),
);

/** Every measurement visit, the ones still waiting first, then newest day first. */
export async function loadMeasurements(): Promise<SiteMeasurement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_logs")
    .select(
      "id, visited_on, supervisor_id, mof_id, site_name, notes, measurement_to, measurement_sent_on, measurement_received, measurement_received_at, mofs(mof_no, project_name)",
    )
    .eq("activity", "measurement")
    .order("measurement_received")
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the measurements: ${error.message}`);
  }
  return rows.parse(data).map((row) => ({
    id: row.id,
    visitedOn: row.visited_on,
    supervisorId: row.supervisor_id,
    mofId: row.mof_id,
    mofNo: row.mofs?.mof_no ?? null,
    siteLabel: row.mofs?.project_name ?? row.site_name ?? "",
    details: row.notes ?? "",
    toId: row.measurement_to,
    sentOn: row.measurement_sent_on,
    received: row.measurement_received,
    receivedOn: row.measurement_received_at
      ? todayMyt(new Date(row.measurement_received_at))
      : null,
  }));
}
