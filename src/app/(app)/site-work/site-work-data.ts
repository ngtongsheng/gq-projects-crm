import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import {
  INSTALLER_CLAIM_TYPES,
  type InstallerClaimType,
} from "@/lib/domain/installer-claim";
import { MOF_STAGES, type MofStageKey } from "@/lib/domain/mof-stages";
import {
  FOLLOW_UP_OWNERS,
  type FollowUpOwner,
  SITE_ACTIVITIES,
  type SiteActivity,
} from "@/lib/domain/site-log";
import { SITE_STAGES, type SiteStage } from "@/lib/domain/site-stage";
import { createClient } from "@/lib/supabase/server";

export type FollowUp = {
  id: string;
  action: string;
  ownerGroup: FollowUpOwner;
  dueOn: string | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
};

export type SiteLog = {
  id: string;
  visitedOn: string;
  supervisorId: string;
  activity: SiteActivity;
  notes: string;
  measurementReceived: boolean;
  driveLink: string | null;
  handoverSigned: boolean;
  followUps: FollowUp[];
};

export type SiteHeader = {
  id: string;
  mofNo: string;
  companyName: string;
  projectName: string;
  siteAddress: string;
  mofStage: MofStageKey;
  siteStage: SiteStage;
};

export type SiteSummary = SiteHeader & {
  lastVisit: { visitedOn: string; activity: SiteActivity } | null;
  openFollowUps: number;
  overdueFollowUps: number;
};

export type PendingClaim = {
  id: string;
  mofId: string;
  mofNo: string;
  projectName: string;
  installer: string;
  poNo: string;
  claimNo: string;
  claimType: InstallerClaimType;
  amount: number;
  claimedOn: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

const followUpRow = z.object({
  id: z.string(),
  action: z.string(),
  owner_group: z.enum(FOLLOW_UP_OWNERS),
  due_on: z.string().nullable(),
  done_at: z.string().nullable(),
  done_by: z.string().nullable(),
});

const logRow = z.object({
  id: z.string(),
  visited_on: z.string(),
  supervisor_id: z.string(),
  activity: z.enum(SITE_ACTIVITIES),
  notes: z.string().nullable(),
  measurement_received: z.boolean(),
  drive_link: z.string().nullable(),
  handover_signed: z.boolean(),
  site_follow_ups: z.array(followUpRow),
});

const mofColumns =
  "id, mof_no, company_name, project_name, site_address, stage, site_stage";

const mofFields = {
  id: z.string(),
  mof_no: z.string(),
  company_name: z.string(),
  project_name: z.string(),
  site_address: z.string().nullable(),
  stage: z.enum(MOF_STAGES),
  site_stage: z.enum(SITE_STAGES),
};

const summaryRows = z.array(
  z.object({
    ...mofFields,
    site_logs: z.array(
      z.object({
        visited_on: z.string(),
        activity: z.enum(SITE_ACTIVITIES),
        site_follow_ups: z.array(
          z.object({
            due_on: z.string().nullable(),
            done_at: z.string().nullable(),
          }),
        ),
      }),
    ),
  }),
);

/** Orders that are not closed or cancelled, with the latest visit and open follow-ups. */
export async function loadActiveSites(today: string): Promise<SiteSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select(
      `${mofColumns}, site_logs(visited_on, activity, site_follow_ups(due_on, done_at))`,
    )
    .not("stage", "in", "(closed,cancelled)")
    .order("mof_no", { ascending: false });
  if (error) throw new Error(`Could not load sites: ${error.message}`);

  return summaryRows.parse(data).map((row) => {
    const latest = [...row.site_logs].sort((a, b) =>
      b.visited_on.localeCompare(a.visited_on),
    )[0];
    const open = row.site_logs
      .flatMap((log) => log.site_follow_ups)
      .filter((followUp) => followUp.done_at === null);
    return {
      id: row.id,
      mofNo: row.mof_no,
      companyName: row.company_name,
      projectName: row.project_name,
      siteAddress: row.site_address ?? "",
      mofStage: row.stage,
      siteStage: row.site_stage,
      lastVisit: latest
        ? { visitedOn: latest.visited_on, activity: latest.activity }
        : null,
      openFollowUps: open.length,
      overdueFollowUps: open.filter(
        (followUp) => followUp.due_on !== null && followUp.due_on < today,
      ).length,
    };
  });
}

const siteRows = z.array(
  z.object({ ...mofFields, site_logs: z.array(logRow) }),
);

/** One order with its visits, newest first, and the follow-ups on each. Null when not found. */
export async function loadSite(
  mofId: string,
): Promise<{ site: SiteHeader; logs: SiteLog[] } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mofs")
    .select(
      `${mofColumns}, site_logs(id, visited_on, supervisor_id, activity, notes, measurement_received, drive_link, handover_signed, site_follow_ups(id, action, owner_group, due_on, done_at, done_by))`,
    )
    .eq("id", mofId);
  if (error) throw new Error(`Could not load the site: ${error.message}`);

  const row = siteRows.parse(data)[0];
  if (!row) return null;
  return {
    site: {
      id: row.id,
      mofNo: row.mof_no,
      companyName: row.company_name,
      projectName: row.project_name,
      siteAddress: row.site_address ?? "",
      mofStage: row.stage,
      siteStage: row.site_stage,
    },
    logs: row.site_logs
      .map((log) => ({
        id: log.id,
        visitedOn: log.visited_on,
        supervisorId: log.supervisor_id,
        activity: log.activity,
        notes: log.notes ?? "",
        measurementReceived: log.measurement_received,
        driveLink: log.drive_link,
        handoverSigned: log.handover_signed,
        followUps: log.site_follow_ups
          .map((followUp) => ({
            id: followUp.id,
            action: followUp.action,
            ownerGroup: followUp.owner_group,
            dueOn: followUp.due_on,
            done: followUp.done_at !== null,
            doneBy: followUp.done_by,
            doneAt: followUp.done_at,
          }))
          .sort((a, b) => Number(a.done) - Number(b.done)),
      }))
      .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn)),
  };
}

const claimRows = z.array(
  z.object({
    id: z.string(),
    claim_type: z.enum(INSTALLER_CLAIM_TYPES),
    claim_no: z.string().nullable(),
    amount: z.number(),
    claimed_on: z.string(),
    installer_pos: z.object({
      installer: z.string(),
      po_no: z.string(),
      mof_id: z.string(),
      mofs: z.object({ mof_no: z.string(), project_name: z.string() }),
    }),
  }),
);

const mofIdRows = z.array(z.object({ mof_id: z.string() }));

/** The MOFs a Site Supervisor has a job on or has logged a visit to. */
async function ownSiteIds(supabase: Supabase, supervisorId: string) {
  const [jobs, logs] = await Promise.all([
    supabase
      .from("jobs")
      .select("mof_id")
      .eq("site_supervisor_id", supervisorId),
    supabase
      .from("site_logs")
      .select("mof_id")
      .eq("supervisor_id", supervisorId),
  ]);
  const failed = jobs.error ?? logs.error;
  if (failed) throw new Error(`Could not load your sites: ${failed.message}`);
  return new Set(
    [...mofIdRows.parse(jobs.data), ...mofIdRows.parse(logs.data)].map(
      (row) => row.mof_id,
    ),
  );
}

/**
 * Installer claims waiting for a supervisor to verify the work. A Site Supervisor sees the
 * sites they have a job or visit on; the MD and Sales Director see every site.
 */
export async function loadPendingClaims(
  me: Pick<Profile, "id" | "jobRole">,
): Promise<PendingClaim[]> {
  const supabase = await createClient();
  const [own, result] = await Promise.all([
    me.jobRole === "site" ? ownSiteIds(supabase, me.id) : Promise.resolve(null),
    supabase
      .from("installer_claims")
      .select(
        "id, claim_type, claim_no, amount, claimed_on, installer_pos:installer_po_id!inner(installer, po_no, mof_id, mofs!inner(mof_no, project_name))",
      )
      .is("verified_by", null)
      .neq("claim_type", "deduction")
      .order("claimed_on"),
  ]);
  if (result.error) {
    throw new Error(`Could not load installer claims: ${result.error.message}`);
  }

  return claimRows
    .parse(result.data)
    .filter((claim) => own === null || own.has(claim.installer_pos.mof_id))
    .map((claim) => ({
      id: claim.id,
      mofId: claim.installer_pos.mof_id,
      mofNo: claim.installer_pos.mofs.mof_no,
      projectName: claim.installer_pos.mofs.project_name,
      installer: claim.installer_pos.installer,
      poNo: claim.installer_pos.po_no,
      claimNo: claim.claim_no ?? "",
      claimType: claim.claim_type,
      amount: claim.amount,
      claimedOn: claim.claimed_on,
    }));
}
