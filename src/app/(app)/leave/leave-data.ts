import { z } from "zod";
import { JobRole } from "@/lib/auth/job-role";
import { LEAVE_STATUSES, LEAVE_TYPES } from "@/lib/domain/leave-balance";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  type LeavePerson,
  type LeaveRow,
  type LeaveSetup,
  overrideKey,
} from "./leave-view";

const leaveRows = z.array(
  z.object({
    id: z.uuid(),
    person_id: z.uuid(),
    leave_type: z.enum(LEAVE_TYPES),
    status: z.enum(LEAVE_STATUSES),
    starts_on: z.iso.date(),
    ends_on: z.iso.date(),
    half_day: z.enum(["am", "pm"]).nullable(),
    days: z.coerce.number(),
    reason: z.string(),
    slip_path: z.string().nullable(),
    slip_file_name: z.string().nullable(),
    original_given_to_hr: z.boolean(),
    applied_at: z.string(),
    decided_by: z.uuid().nullable(),
    decided_at: z.string().nullable(),
    decision_note: z.string(),
    leave_approval_steps: z.array(
      z.object({
        position: z.number(),
        approver_id: z.uuid().nullable(),
        approver_role: z.enum(["md", "director"]).nullable(),
        decision: z.enum(["approved", "rejected"]).nullable(),
      }),
    ),
  }),
);

// Stamps are moments; the page shows the Malaysian day they fell on.
const dayOf = (moment: string) => todayMyt(new Date(moment));

/** Every leave request this person may read; row-level security does the narrowing. */
export async function loadLeaveRows(): Promise<LeaveRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, person_id, leave_type, status, starts_on, ends_on, half_day, days, reason, slip_path, slip_file_name, original_given_to_hr, applied_at, decided_by, decided_at, decision_note, leave_approval_steps(position, approver_id, approver_role, decision)",
    );
  if (error) throw new Error(`Could not load leave: ${error.message}`);
  return leaveRows.parse(data).map((row) => ({
    id: row.id,
    personId: row.person_id,
    leaveType: row.leave_type,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    halfDay: row.half_day,
    days: row.days,
    reason: row.reason,
    hasSlip: row.slip_path !== null,
    slipFileName: row.slip_file_name,
    originalGivenToHr: row.original_given_to_hr,
    appliedOn: dayOf(row.applied_at),
    decidedById: row.decided_by,
    decidedOn: row.decided_at ? dayOf(row.decided_at) : null,
    decisionNote: row.decision_note,
    steps: row.leave_approval_steps.map((step) => {
      const base = { position: step.position, decision: step.decision };
      if (step.approver_id) return { ...base, approverId: step.approver_id };
      if (step.approver_role) {
        return { ...base, approverRole: step.approver_role };
      }
      throw new Error("A leave approval step names nobody.");
    }),
  }));
}

const settingRows = z.array(
  z.object({ key: z.string(), value: z.union([z.number(), z.boolean()]) }),
);

const entitlementRows = z.array(
  z.object({
    profile_id: z.uuid(),
    year: z.number(),
    annual_days: z.coerce.number(),
    carried_days: z.coerce.number(),
    mc_days: z.coerce.number(),
  }),
);

/** The company default (app_settings) and the per-person overrides, as the balance maths wants them. */
export async function loadLeaveSetup(): Promise<LeaveSetup> {
  const supabase = await createClient();
  const [settings, overrides] = await Promise.all([
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["leave_annual_days", "leave_mc_days", "leave_prorate"]),
    supabase
      .from("leave_entitlements")
      .select("profile_id, year, annual_days, carried_days, mc_days"),
  ]);
  if (settings.error) {
    throw new Error(
      `Could not load the leave policy: ${settings.error.message}`,
    );
  }
  if (overrides.error) {
    throw new Error(`Could not load entitlements: ${overrides.error.message}`);
  }
  const byKey = new Map(
    settingRows.parse(settings.data).map((row) => [row.key, row.value]),
  );
  const number = (key: string, fallback: number) => {
    const value = byKey.get(key);
    return typeof value === "number" ? value : fallback;
  };
  return {
    policy: {
      annualDays: number("leave_annual_days", 14),
      mcDays: number("leave_mc_days", 14),
      prorate: byKey.get("leave_prorate") !== false,
    },
    overrides: new Map(
      entitlementRows.parse(overrides.data).map((row) => [
        overrideKey(row.profile_id, row.year),
        {
          annualDays: row.annual_days,
          carriedDays: row.carried_days,
          mcDays: row.mc_days,
        },
      ]),
    ),
  };
}

const personRows = z.array(
  z.object({
    id: z.uuid(),
    job_role: JobRole,
    joined_on: z.iso.date().nullable(),
    reports_to: z.uuid().nullable(),
  }),
);

/** The people whose leave this person reads, with join date and job role. Names come from the team directory. */
export async function loadLeavePeople(
  nameOf: (personId: string) => string,
): Promise<LeavePerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leave_people");
  if (error) throw new Error(`Could not load the team: ${error.message}`);
  return personRows.parse(data).map((row) => ({
    id: row.id,
    name: nameOf(row.id),
    jobRole: row.job_role,
    joinedOn: row.joined_on,
    reportsTo: row.reports_to,
  }));
}
