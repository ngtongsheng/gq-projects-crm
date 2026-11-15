import { z } from "zod";
import { currentWait, type FollowUpWait } from "@/lib/domain/follow-up-snooze";
import { FOLLOW_UP_OWNERS, type FollowUpOwner } from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { toWaits, WAITS_SELECT, waitRows } from "./follow-up-waits";

export type SiteAction = {
  id: string;
  action: string;
  ownerGroup: FollowUpOwner;
  assigneeId: string | null;
  dueOn: CalendarDate | null;
  /** When it was ticked off and by whom; null while open. */
  doneAt: string | null;
  doneBy: string | null;
  wait: FollowUpWait | null;
  /** Null when the visit had no MOF yet. */
  mofId: string | null;
  mofNo: string | null;
  /** The MOF's project, or the site typed in for a new site. */
  siteLabel: string;
  salespersonId: string | null;
  raisedBy: string;
  raisedOn: CalendarDate;
};

const actionRows = z.array(
  z.object({
    id: z.string(),
    action: z.string(),
    owner_group: z.enum(FOLLOW_UP_OWNERS),
    assignee_id: z.string().nullable(),
    due_on: z.iso.date().nullable(),
    done_at: z.string().nullable(),
    done_by: z.string().nullable(),
    site_follow_up_waits: waitRows,
    site_logs: z.object({
      mof_id: z.string().nullable(),
      site_name: z.string().nullable(),
      salesperson_id: z.string().nullable(),
      supervisor_id: z.string(),
      visited_on: z.iso.date(),
      mofs: z
        .object({
          mof_no: z.string(),
          project_name: z.string(),
          salesperson_id: z.string(),
        })
        .nullable(),
    }),
  }),
);

const COMPLETED_SHOWN = 100;

/**
 * Follow-ups raised by site visits: every open one, or the latest completed ones. Marketing
 * cannot read follow-ups, so for them this is empty.
 */
export async function loadSiteActions(
  completed: boolean,
): Promise<SiteAction[]> {
  const supabase = await createClient();
  const query = supabase
    .from("site_follow_ups")
    .select(
      `id, action, owner_group, assignee_id, due_on, done_at, done_by, ${WAITS_SELECT}, site_logs!inner(mof_id, site_name, salesperson_id, supervisor_id, visited_on, mofs(mof_no, project_name, salesperson_id))`,
    );
  const { data, error } = await (completed
    ? query
        .not("done_at", "is", null)
        .order("done_at", { ascending: false })
        .limit(COMPLETED_SHOWN)
    : query.is("done_at", null));
  if (error) throw new Error(`Could not load the actions: ${error.message}`);

  return actionRows.parse(data).map((row) => {
    const log = row.site_logs;
    return {
      id: row.id,
      action: row.action,
      ownerGroup: row.owner_group,
      assigneeId: row.assignee_id,
      dueOn: row.due_on,
      doneAt: row.done_at,
      doneBy: row.done_by,
      wait: currentWait(toWaits(row.site_follow_up_waits)),
      mofId: log.mof_id,
      mofNo: log.mofs?.mof_no ?? null,
      siteLabel: log.mofs?.project_name ?? log.site_name ?? "",
      salespersonId: log.mofs?.salesperson_id ?? log.salesperson_id,
      raisedBy: log.supervisor_id,
      raisedOn: log.visited_on,
    };
  });
}
