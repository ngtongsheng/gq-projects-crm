import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSection } from "@/lib/auth/require-section";
import { customerHealth } from "@/lib/domain/customer-health";
import { formatMobile } from "@/lib/domain/mobile";
import { todayMyt } from "@/lib/format/date";
import { canLogActivity } from "../../activities/activity-access";
import { ActivityDialog } from "../../activities/activity-form";
import { CustomerActivities } from "../../activities/customer-activities";
import { lastCompletedDay } from "../../activities/last-activity";
import { CustomerProjects } from "../../projects/customer-projects";
import { canChoosePic, canCreateProject } from "../../projects/project-access";
import { ProjectDialog } from "../../projects/project-form";
import { canEditContact, canSetAccountType } from "../contact-access";
import { ContactDialog } from "../contact-form";
import { CustomerHealthBadge } from "../customer-health-badge";
import { RatingBadge } from "../rating-badge";
import { AccountTypeLabel, CompanyTypeLabel } from "../schemas";
import { loadCustomerDetail } from "./customer-detail";

export const metadata: Metadata = { title: "Customer" };

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

  const detail = await loadCustomerDetail(me, id);
  if (!detail) notFound();
  const {
    customer,
    colleagues,
    companies,
    team,
    nameOf,
    ownerIds,
    ownerNames,
    activities,
    projects,
  } = detail;
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
                <RatingBadge rating={customer.rating} />
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
