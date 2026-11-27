import { z } from "zod";
import { endOfMonth } from "@/lib/domain/calendar-grid";
import {
  FOLLOW_UP_OWNERS,
  type FollowUpOwner,
  SITE_ACTIVITIES,
  type SiteActivity,
} from "@/lib/domain/site-log";
import { type CalendarDate, todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";

export type MonthLog = {
  id: string;
  visitedOn: CalendarDate;
  supervisorId: string;
  activity: SiteActivity;
  mofId: string | null;
  mofNo: string | null;
  /** The site typed in for a new site with no MOF. */
  siteName: string | null;
  /** The MOF's project, or the site typed in for a new site. */
  siteLabel: string;
  details: string;
  installedPct: number | null;
  handoverSigned: boolean;
  returnAnswer: string | null;
  measurement: {
    toId: string | null;
    sentOn: CalendarDate | null;
    received: boolean;
    receivedOn: CalendarDate | null;
  };
  photos: {
    toId: string | null;
    postedOn: CalendarDate | null;
    savedById: string | null;
    savedOn: CalendarDate | null;
    driveLink: string | null;
  };
  followUps: {
    id: string;
    action: string;
    ownerGroup: FollowUpOwner;
    dueOn: CalendarDate | null;
    done: boolean;
  }[];
};

const dayOf = (moment: string) => todayMyt(new Date(moment));

const logRows = z.array(
  z.object({
    id: z.string(),
    visited_on: z.iso.date(),
    supervisor_id: z.string(),
    activity: z.enum(SITE_ACTIVITIES),
    mof_id: z.string().nullable(),
    site_name: z.string().nullable(),
    notes: z.string().nullable(),
    inst_pct: z.number().nullable(),
    handover_signed: z.boolean(),
    return_answer: z.string().nullable(),
    measurement_to: z.string().nullable(),
    measurement_sent_on: z.iso.date().nullable(),
    measurement_received: z.boolean(),
    measurement_received_at: z.string().nullable(),
    photos_to: z.string().nullable(),
    photos_posted_on: z.iso.date().nullable(),
    photos_saved_by: z.string().nullable(),
    photos_saved_at: z.string().nullable(),
    drive_link: z.string().nullable(),
    mofs: z.object({ mof_no: z.string(), project_name: z.string() }).nullable(),
    site_follow_ups: z.array(
      z.object({
        id: z.string(),
        action: z.string(),
        owner_group: z.enum(FOLLOW_UP_OWNERS),
        due_on: z.iso.date().nullable(),
        done_at: z.string().nullable(),
      }),
    ),
  }),
);

/** Every supervisor's logs for the month, newest day first. */
export async function loadMonthLogs(month: CalendarDate): Promise<MonthLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_logs")
    .select(
      "id, visited_on, supervisor_id, activity, mof_id, site_name, notes, inst_pct, handover_signed, return_answer, measurement_to, measurement_sent_on, measurement_received, measurement_received_at, photos_to, photos_posted_on, photos_saved_by, photos_saved_at, drive_link, mofs(mof_no, project_name), site_follow_ups(id, action, owner_group, due_on, done_at)",
    )
    .gte("visited_on", month)
    .lte("visited_on", endOfMonth(month))
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load the site log: ${error.message}`);

  return logRows.parse(data).map((row) => ({
    id: row.id,
    visitedOn: row.visited_on,
    supervisorId: row.supervisor_id,
    activity: row.activity,
    mofId: row.mof_id,
    mofNo: row.mofs?.mof_no ?? null,
    siteName: row.site_name,
    siteLabel: row.mofs?.project_name ?? row.site_name ?? "",
    details: row.notes ?? "",
    installedPct: row.inst_pct,
    handoverSigned: row.handover_signed,
    returnAnswer: row.return_answer,
    measurement: {
      toId: row.measurement_to,
      sentOn: row.measurement_sent_on,
      received: row.measurement_received,
      receivedOn: row.measurement_received_at
        ? dayOf(row.measurement_received_at)
        : null,
    },
    photos: {
      toId: row.photos_to,
      postedOn: row.photos_posted_on,
      savedById: row.photos_saved_by,
      savedOn: row.photos_saved_at ? dayOf(row.photos_saved_at) : null,
      driveLink: row.drive_link,
    },
    followUps: row.site_follow_ups.map((followUp) => ({
      id: followUp.id,
      action: followUp.action,
      ownerGroup: followUp.owner_group,
      dueOn: followUp.due_on,
      done: followUp.done_at !== null,
    })),
  }));
}

export type MonthOffDay = {
  profileId: string;
  kind: "office" | "other";
  startsOn: CalendarDate;
  endsOn: CalendarDate;
};

const offRows = z.array(
  z.object({
    profile_id: z.string(),
    kind: z.enum(["office", "other"]),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
  }),
);

/** The office and other days anyone's site_off holds that touch the month. */
export async function loadMonthOffDays(
  month: CalendarDate,
): Promise<MonthOffDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_off")
    .select("profile_id, kind, starts_on, ends_on")
    .lte("starts_on", endOfMonth(month))
    .gte("ends_on", month);
  if (error) throw new Error(`Could not load the days away: ${error.message}`);
  return offRows.parse(data).map((row) => ({
    profileId: row.profile_id,
    kind: row.kind,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  }));
}
