import { z } from "zod";
import { currentWait, type FollowUpWait } from "@/lib/domain/follow-up-snooze";
import { FOLLOW_UP_OWNERS, type FollowUpOwner } from "@/lib/domain/site-log";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { toWaits, WAITS_SELECT, waitRows } from "../site-work/follow-up-waits";

const openFollowUpRows = z.array(
  z.object({
    id: z.string(),
    action: z.string(),
    owner_group: z.enum(FOLLOW_UP_OWNERS),
    assignee_id: z.string().nullable(),
    due_on: z.iso.date().nullable(),
    site_follow_up_waits: waitRows,
    site_logs: z.object({
      mof_id: z.string().nullable(),
      site_name: z.string().nullable(),
      mofs: z
        .object({ mof_no: z.string(), project_name: z.string() })
        .nullable(),
    }),
  }),
);

export type OpenFollowUp = {
  id: string;
  action: string;
  ownerGroup: FollowUpOwner;
  assigneeId: string | null;
  dueOn: CalendarDate | null;
  wait: FollowUpWait | null;
  /** Null when the visit had no MOF yet. */
  mofId: string | null;
  /** MOF no. and project, or the typed-in site. */
  siteLabel: string;
};

/** Every open follow-up; the caller keeps the ones that are this person's to chase. */
export async function loadOpenFollowUps(): Promise<OpenFollowUp[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_follow_ups")
    .select(
      `id, action, owner_group, assignee_id, due_on, ${WAITS_SELECT}, site_logs!inner(mof_id, site_name, mofs(mof_no, project_name))`,
    )
    .is("done_at", null)
    .order("due_on", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Could not load follow-ups: ${error.message}`);
  return openFollowUpRows.parse(data).map((row) => {
    const mof = row.site_logs.mofs;
    return {
      id: row.id,
      action: row.action,
      ownerGroup: row.owner_group,
      assigneeId: row.assignee_id,
      dueOn: row.due_on,
      wait: currentWait(toWaits(row.site_follow_up_waits)),
      mofId: row.site_logs.mof_id,
      siteLabel: mof
        ? `${mof.mof_no} · ${mof.project_name}`
        : (row.site_logs.site_name ?? ""),
    };
  });
}
