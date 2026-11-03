import { z } from "zod";
import type { Profile } from "@/lib/auth/current-profile";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { createClient } from "@/lib/supabase/server";
import { canEditActivity } from "../../activities/activity-access";
import type { CustomerActivity } from "../../activities/customer-activities";
import { ActivityStatus, ActivityType } from "../../activities/schemas";
import type { CustomerProject } from "../../projects/customer-projects";
import { canEditProject } from "../../projects/project-access";
import { LeadSource, ProjectStage } from "../../projects/schemas";
import { AccountType, CompanyType } from "../schemas";

const customerRow = z.object({
  id: z.string(),
  company_id: z.string(),
  name: z.string(),
  mobile: z.string(),
  title: z.string().nullable(),
  rating: z.number().int(),
  account_type: AccountType,
  passed_by: z.string().nullable(),
  notes: z.string().nullable(),
  companies: z.object({
    name: z.string(),
    company_type: CompanyType,
    address: z.string().nullable(),
  }),
  contact_owners: z.array(z.object({ profile_id: z.string() })),
});

const colleagueRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    title: z.string().nullable(),
    mobile: z.string(),
  }),
);

const companyRows = z.array(z.object({ id: z.string(), name: z.string() }));

const activityRows = z.array(
  z.object({
    id: z.string(),
    owner_id: z.string(),
    type: ActivityType,
    purpose: z.string(),
    outcome: z.string().nullable(),
    starts_at: z.string(),
    status: ActivityStatus,
  }),
);

const projectRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    lead_source: LeadSource,
    stage: ProjectStage,
    qty_sqft: z.number(),
    value: z.number(),
    pic_id: z.string(),
    support_id: z.string().nullable(),
    passed_by: z.string().nullable(),
    commission_type: AccountType,
    next_action: z.string().nullable(),
    next_action_date: z.string().nullable(),
    notes: z.string().nullable(),
  }),
);

/** The customer, the people at the same company, and their activities and projects. Null when the customer is gone. */
export async function loadCustomerDetail(me: Profile, id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, company_id, name, mobile, title, rating, account_type, passed_by, notes, companies(name, company_type, address), contact_owners(profile_id)",
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`Could not load customer: ${error.message}`);
  if (!data) return null;
  const customer = customerRow.parse(data);

  const [
    colleaguesResult,
    companiesResult,
    activitiesResult,
    projectsResult,
    team,
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, title, mobile")
      .eq("company_id", customer.company_id)
      .neq("id", customer.id)
      .is("archived_at", null)
      .order("name"),
    supabase.from("companies").select("id, name").order("name"),
    supabase
      .from("activities")
      .select("id, owner_id, type, purpose, outcome, starts_at, status")
      .eq("contact_id", customer.id)
      .order("starts_at", { ascending: false }),
    supabase
      .from("projects")
      .select(
        "id, name, lead_source, stage, qty_sqft, value, pic_id, support_id, passed_by, commission_type, next_action, next_action_date, notes",
      )
      .eq("contact_id", customer.id)
      .order("created_at", { ascending: false }),
    getTeamDirectory(),
  ]);
  if (colleaguesResult.error) {
    throw new Error(
      `Could not load the company's contacts: ${colleaguesResult.error.message}`,
    );
  }
  if (companiesResult.error) {
    throw new Error(
      `Could not load companies: ${companiesResult.error.message}`,
    );
  }
  if (activitiesResult.error) {
    throw new Error(
      `Could not load activities: ${activitiesResult.error.message}`,
    );
  }
  if (projectsResult.error) {
    throw new Error(`Could not load projects: ${projectsResult.error.message}`);
  }
  const colleagues = colleagueRows.parse(colleaguesResult.data);
  const companies = companyRows.parse(companiesResult.data);
  const nameOf = new Map(team.map((member) => [member.id, member.name]));
  const ownerIds = customer.contact_owners.map((owner) => owner.profile_id);
  const ownerNames = ownerIds.map(
    (ownerId) => nameOf.get(ownerId) ?? "Unnamed",
  );
  const activities: CustomerActivity[] = activityRows
    .parse(activitiesResult.data)
    .map((row) => ({
      id: row.id,
      ownerName: nameOf.get(row.owner_id) ?? "Unnamed",
      type: row.type,
      purpose: row.purpose,
      outcome: row.outcome,
      startsAt: row.starts_at,
      status: row.status,
      canEdit: canEditActivity(me.jobRole, row.owner_id === me.id),
    }));
  const projects: CustomerProject[] = projectRows
    .parse(projectsResult.data)
    .map((row) => ({
      id: row.id,
      name: row.name,
      leadSource: row.lead_source,
      stage: row.stage,
      qtySqft: row.qty_sqft,
      value: row.value,
      picId: row.pic_id,
      supportId: row.support_id,
      commissionType: row.commission_type,
      passedBy: row.passed_by,
      nextAction: row.next_action ?? "",
      nextActionDate: row.next_action_date ?? "",
      notes: row.notes ?? "",
      picName: nameOf.get(row.pic_id) ?? "Unnamed",
      supportName: row.support_id
        ? (nameOf.get(row.support_id) ?? "Unnamed")
        : null,
      canEdit: canEditProject(
        me.jobRole,
        row.pic_id === me.id || row.support_id === me.id,
      ),
    }));
  return {
    customer,
    colleagues,
    companies,
    team,
    nameOf,
    ownerIds,
    ownerNames,
    activities,
    projects,
  };
}
