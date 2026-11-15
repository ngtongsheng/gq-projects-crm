import { Users } from "lucide-react";
import type { Metadata } from "next";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { loadAccessOverrides } from "@/lib/auth/access-overrides";
import {
  CommissionMode,
  canLeadTeam,
  canSeeHr,
  isManager,
  JobRole,
  JobRoleLabel,
} from "@/lib/auth/job-role";
import { type RoleKey, roleKeyOf } from "@/lib/auth/pages";
import { requireRole } from "@/lib/auth/require-role";
import { salesTeams } from "@/lib/domain/sales-teams";
import { formatDate, todayMyt } from "@/lib/format/date";
import { Language } from "@/lib/i18n/dictionary";
import {
  ADMIN_UNAVAILABLE_MESSAGE,
  createAdminClient,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { refreshYearlyTargets } from "@/lib/yearly-targets";
import { AddPersonDialog } from "./add-person-dialog";
import { loadGradeTargets, loadYearlyTargets } from "./people-targets-data";
import { PersonSettingsDialog } from "./person-settings-dialog";
import { RoleAccess } from "./role-access";
import { RoleSelect } from "./role-select";
import { SalesTeamsPanel } from "./sales-teams-panel";
import { roleSchema } from "./schemas";
import { ViewAsButton } from "./view-as-button";

export const metadata: Metadata = { title: "People" };

/** Emails live in the auth system, which only the service key can read. */
async function emailsById(): Promise<Map<string, string> | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Could not load emails: ${error.message}`);
  return new Map(data.users.map((user) => [user.id, user.email ?? ""]));
}

export default async function PeoplePage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const year = Number(todayMyt().slice(0, 4));
  // Only the MD, directors and HR & Accounts set targets (row-level security); only the MD and
  // HR & Accounts read grades, so only they see a grade default.
  const setsTargets = isManager(me.jobRole);

  await refreshYearlyTargets();
  const [{ data: profiles, error }, emails, ownTargets, gradeTargets] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, role, job_role, arranges_stock, commission_mode, yearly_target, created_at, title, joined_on, active, left_on, left_reason, reports_to, sells, sees_margin, whatsapp, language",
        )
        .order("created_at"),
      emailsById(),
      setsTargets ? loadYearlyTargets([year, year + 1]) : null,
      setsTargets && canSeeHr(me.jobRole) ? loadGradeTargets() : null,
    ]);
  if (error) throw new Error(`Could not load people: ${error.message}`);

  const rows = profiles.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: emails?.get(row.id) ?? null,
    role: roleSchema.parse(row.role),
    settings: {
      userId: row.id,
      name: row.full_name,
      jobRole: JobRole.parse(row.job_role),
      arrangesStock: row.arranges_stock === true,
      sells: row.sells === true,
      seesMargin: row.sees_margin === true,
      commissionMode: CommissionMode.parse(row.commission_mode),
      targets: ownTargets
        ? {
            years: [year, year + 1].map((target) => ({
              salesTarget: null,
              visitTarget: null,
              ...ownTargets.get(row.id)?.find((own) => own.year === target),
              year: target,
            })),
            gradeTarget: gradeTargets?.get(row.id) ?? null,
          }
        : null,
      whatsapp: row.whatsapp,
      title: row.title,
      joinedOn: row.joined_on,
      reportsTo: row.reports_to,
      language: Language.parse(row.language),
      active: row.active === true,
      leftOn: row.left_on,
      leftReason: row.left_reason,
    },
    // This year's effective target (own row, else grade), kept on profiles by the database.
    salesTarget: row.yearly_target === null ? null : Number(row.yearly_target),
    joined: formatDate(row.joined_on ?? todayMyt(new Date(row.created_at))),
  }));

  const peopleByRole: Partial<Record<RoleKey, string[]>> = {};
  for (const row of rows) {
    if (!row.settings.active) continue;
    const roleKey = roleKeyOf(row.settings);
    peopleByRole[roleKey] = [
      ...(peopleByRole[roleKey] ?? []),
      row.name ?? "Unnamed",
    ];
  }

  // Who a person can report to: a Sales Director or Marketing Director still working here.
  const leads = rows
    .filter((row) => row.settings.active && canLeadTeam(row.settings.jobRole))
    .map((row) => ({ id: row.id, name: row.name ?? "Unnamed" }));

  const teams = salesTeams(
    rows.map((row) => ({
      id: row.id,
      name: row.name ?? "Unnamed",
      title: row.settings.title,
      jobRole: row.settings.jobRole,
      active: row.settings.active,
      reportsTo: row.settings.reportsTo,
      salesTarget: row.salesTarget,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="People"
        description={
          emails
            ? undefined
            : "Emails and adding people work on the preview link or the live site."
        }
        actions={
          <AddPersonDialog
            unavailableMessage={emails ? null : ADMIN_UNAVAILABLE_MESSAGE}
            leads={leads}
          />
        }
      />
      <SalesTeamsPanel teams={teams} year={year} />
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        empty={<EmptyState icon={Users} title="No people yet" />}
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (row) => row.name ?? "–",
          },
          {
            key: "email",
            header: "Email",
            cell: (row) => row.email ?? "–",
          },
          {
            key: "role",
            header: "Role",
            cell: (row) => (
              <RoleSelect
                userId={row.id}
                role={row.role}
                isSelf={row.id === me.id}
              />
            ),
          },
          {
            key: "jobRole",
            header: "Job role",
            cell: (row) =>
              row.settings.active
                ? JobRoleLabel[row.settings.jobRole]
                : `${JobRoleLabel[row.settings.jobRole]} · Left`,
          },
          {
            key: "joined",
            header: "Joined",
            numeric: true,
            cell: (row) => row.joined,
          },
          {
            key: "settings",
            header: "Settings",
            cell: (row) => (
              <div className="flex flex-wrap gap-2">
                <PersonSettingsDialog person={row.settings} leads={leads} />
                {me.jobRole === "md" && row.id !== me.id && (
                  <ViewAsButton userId={row.id} name={row.name} />
                )}
              </div>
            ),
          },
        ]}
      />
      {me.jobRole === "md" && (
        <RoleAccess
          overrides={await loadAccessOverrides()}
          people={peopleByRole}
        />
      )}
    </div>
  );
}
