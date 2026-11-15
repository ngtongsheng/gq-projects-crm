import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { canLeadTeam } from "@/lib/auth/job-role";
import { loadMyTeam } from "@/lib/auth/my-team";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import type { CalendarDate } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import { VisitResult } from "../activities/outcome-schema";
import { ActivityStatus, ActivityType } from "../activities/schemas";
import { loadReportFilers } from "../reports/report-filers";
import { mytWindow } from "./calendar-period";
import {
  filesWeeklyReport,
  type OutcomeActivity,
  outcomesWeek,
  type WeeklyReport,
  weeklyOutcomes,
} from "./weekly-outcomes-data";

const activityRows = z.array(
  z.object({
    id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    status: ActivityStatus,
    starts_at: z.string(),
    result: VisitResult.nullable(),
    outcome: z.string().nullable(),
    late_logged: z.boolean(),
    logged_at: z.string().nullable(),
    lead_project_id: z.string().nullable(),
    lead: z.object({ name: z.string(), value: z.number() }).nullable(),
    contacts: z.object({
      name: z.string(),
      companies: z.object({ name: z.string() }),
    }),
  }),
);

const reportRows = z.array(
  z.object({
    id: z.string(),
    profile_id: z.string(),
    status: z.enum(["submitted", "reviewed"]),
    note: z.string().nullable(),
    submitted_at: z.string(),
    late: z.boolean(),
    review_note: z.string().nullable(),
  }),
);

const dueAtValue = z.string();

/**
 * Everything the Weekly outcomes tab shows for the week holding `date`: `picked` narrows a
 * manager to one person; otherwise the viewer's team (public.my_team()) or, for the MD, everyone.
 */
export async function loadWeeklyOutcomes(input: {
  me: Profile;
  date: CalendarDate;
  picked: string | undefined;
}) {
  const { me, picked } = input;
  const { monday, sunday } = outcomesWeek(input.date);
  const team = await loadMyTeam();
  const scope = picked ? [picked] : team;

  const [directory, filers, activities, reports, dueAt] = await Promise.all([
    getTeamDirectory(),
    loadReportFilers(),
    loadOutcomeActivities(scope, monday, sunday),
    loadWeeklyReports(scope, monday),
    loadWeeklyReportDue(monday),
  ]);

  // Report filers list only the people a manager may see; a team lead's team is all
  // salespeople, and everyone knows their own role.
  const filerIds = new Set([
    ...filers.filter((f) => f.kind !== "site").map((f) => f.id),
    ...(canLeadTeam(me.jobRole) && team
      ? team.filter((id) => id !== me.id)
      : []),
    ...(filesWeeklyReport(me.jobRole) ? [me.id] : []),
  ]);
  const now = new Date();

  return {
    monday,
    dueAt,
    now,
    team,
    rows: weeklyOutcomes({
      week: monday,
      scope,
      filers: filerIds,
      nameOf: new Map(directory.map((m) => [m.id, m.name])),
      activities,
      reports,
      dueAt,
      now,
    }),
  };
}

async function loadOutcomeActivities(
  scope: readonly string[] | null,
  monday: CalendarDate,
  sunday: CalendarDate,
): Promise<OutcomeActivity[]> {
  const window = mytWindow(monday, sunday);
  const supabase = await createClient();
  let query = supabase
    .from("activities")
    .select(
      "id, owner_id, type, status, starts_at, result, outcome, late_logged, logged_at, lead_project_id, lead:projects!lead_project_id(name, value), contacts(name, companies(name))",
    )
    .neq("status", "cancelled")
    .gte("starts_at", window.start)
    .lt("starts_at", window.end)
    .order("starts_at");
  if (scope) query = query.in("owner_id", [...scope]);
  const { data, error } = await query;
  if (error)
    throw new Error(`Could not load the week's visits: ${error.message}`);
  return activityRows.parse(data).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    status: row.status,
    startsAt: row.starts_at,
    result: row.result,
    outcome: row.outcome,
    lateLogged: row.late_logged,
    loggedAt: row.logged_at,
    leadProjectId: row.lead_project_id,
    lead: row.lead,
    customer: row.contacts.name,
    company: row.contacts.companies.name,
  }));
}

async function loadWeeklyReports(
  scope: readonly string[] | null,
  monday: CalendarDate,
): Promise<WeeklyReport[]> {
  const supabase = await createClient();
  let query = supabase
    .from("weekly_reports")
    .select("id, profile_id, status, note, submitted_at, late, review_note")
    .eq("week", monday);
  if (scope) query = query.in("profile_id", [...scope]);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load the weekly reports: ${error.message}`);
  }
  return reportRows.parse(data).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    status: row.status,
    note: row.note,
    submittedAt: row.submitted_at,
    late: row.late,
    reviewNote: row.review_note,
  }));
}

/** The week's deadline from the weekly_report_due setting (D6), worked out by the database. */
async function loadWeeklyReportDue(monday: CalendarDate): Promise<Date> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("weekly_report_due_at", {
    day: monday,
  });
  if (error) {
    throw new Error(`Could not load the report deadline: ${error.message}`);
  }
  return new Date(dueAtValue.parse(data));
}
