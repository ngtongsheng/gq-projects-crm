import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, type StatusTone } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSection } from "@/lib/auth/require-section";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { customerHealth } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { todayMyt } from "@/lib/format/date";
import { createClient } from "@/lib/supabase/server";
import {
  canEditActivity,
  canLogActivity,
} from "../../activities/activity-access";
import { ActivityDialog } from "../../activities/activity-form";
import {
  CustomerActivities,
  type CustomerActivity,
} from "../../activities/customer-activities";
import { lastCompletedDay } from "../../activities/last-activity";
import { ActivityStatus, ActivityType } from "../../activities/schemas";
import {
  type CustomerProject,
  CustomerProjects,
} from "../../projects/customer-projects";
import {
  canChoosePic,
  canCreateProject,
  canEditProject,
} from "../../projects/project-access";
import { ProjectDialog } from "../../projects/project-form";
import { LeadSource, ProjectStage } from "../../projects/schemas";
import { canEditContact, canSetAccountType } from "../contact-access";
import { ContactDialog } from "../contact-form";
import { CustomerHealthBadge } from "../customer-health-badge";
import {
  AccountType,
  AccountTypeLabel,
  CompanyType,
  CompanyTypeLabel,
  RatingLabel,
} from "../schemas";

export const metadata: Metadata = { title: "Customer" };

const ratingTone: Record<number, StatusTone> = {
  1: "bad",
  2: "warn",
  3: "neutral",
  4: "info",
  5: "good",
};

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireSection("customers");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

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
  if (!data) notFound();
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
  const projectDialog = {
    team,
    canChoosePic: canChoosePic(me.jobRole),
    me: { id: me.id, name: nameOf.get(me.id) ?? me.fullName ?? "Unnamed" },
    customerCommission: {
      type: customer.account_type,
      passedBy: customer.passed_by,
    },
  };
  const health = customerHealth(
    lastCompletedDay(
      activities.map((a) => ({ status: a.status, startsAt: a.startsAt })),
    ),
    todayMyt(),
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/customers"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Customers
      </Link>
      <PageHeader
        title={customer.name}
        description={[customer.title, customer.companies.name]
          .filter(Boolean)
          .join(" · ")}
        actions={
          canEditContact(me.jobRole, ownerIds.includes(me.id)) ? (
            <ContactDialog
              contact={{
                id: customer.id,
                companyId: customer.company_id,
                name: customer.name,
                mobile: formatMobile(customer.mobile),
                title: customer.title ?? "",
                rating: customer.rating,
                accountType: customer.account_type,
                passedBy: customer.passed_by ?? "",
                notes: customer.notes ?? "",
              }}
              companies={companies}
              team={team}
              canSetAccountType={canSetAccountType(me.jobRole)}
              canRequestOwnership={false}
            />
          ) : undefined
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading">Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile">
                <span className="font-mono tabular-nums">
                  {formatMobile(customer.mobile)}
                </span>
              </Field>
              <Field label="Company">
                {customer.companies.name} ·{" "}
                {CompanyTypeLabel[customer.companies.company_type]}
              </Field>
              <Field label="Owners">{ownerNames.join(" + ") || "–"}</Field>
              <Field label="Account type">
                {AccountTypeLabel[customer.account_type]}
                {customer.passed_by &&
                  ` · passed down by ${nameOf.get(customer.passed_by) ?? "Unnamed"}`}
              </Field>
              <Field label="Rating">
                <StatusBadge tone={ratingTone[customer.rating] ?? "neutral"}>
                  {customer.rating} · {RatingLabel[customer.rating]}
                </StatusBadge>
              </Field>
              <Field label="Health">
                <CustomerHealthBadge health={health} />
              </Field>
              {customer.companies.address && (
                <Field label="Address">{customer.companies.address}</Field>
              )}
              {customer.notes && <Field label="Notes">{customer.notes}</Field>}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">
              Others at {customer.companies.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {colleagues.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other contacts at this company.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {colleagues.map((colleague) => (
                  <li key={colleague.id} className="flex flex-col">
                    <Link
                      href={`/customers/${colleague.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {colleague.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {colleague.title ? `${colleague.title} · ` : ""}
                      <span className="font-mono tabular-nums">
                        {formatMobile(colleague.mobile)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-heading">Activities</CardTitle>
          {canLogActivity(me.jobRole) && (
            <ActivityDialog
              contactId={customer.id}
              customerName={customer.name}
            />
          )}
        </CardHeader>
        <CardContent>
          <CustomerActivities
            contactId={customer.id}
            customerName={customer.name}
            activities={activities}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="font-heading">Projects</CardTitle>
          {canCreateProject(me.jobRole, ownerIds.includes(me.id)) && (
            <ProjectDialog
              {...projectDialog}
              contactId={customer.id}
              customerName={customer.name}
            />
          )}
        </CardHeader>
        <CardContent>
          <CustomerProjects
            contactId={customer.id}
            customerName={customer.name}
            projects={projects}
            dialog={projectDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
