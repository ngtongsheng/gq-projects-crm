import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { canChangeSettings, canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { splitPolicies } from "@/lib/domain/hr-policy";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { loadGradesData } from "./grades-data";
import { GradesView } from "./grades-view";
import { HrTabs } from "./hr-tabs";
import { parseHrView } from "./hr-view";
import { PoliciesView } from "./policies-view";
import { loadPoliciesData } from "./policy-data";
import { PolicyDialog } from "./policy-dialog";
import { loadStaffData } from "./staff-data";
import { StaffView } from "./staff-view";

export const metadata: Metadata = { title: "HR" };

export default async function HrPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePage("hr");
  // The database holds the same line: only the MD and HR & Accounts read the HR tables.
  if (!canSeeHr(me.jobRole)) redirect("/not-allowed");
  const t = await getT(me.language);
  const view = parseHrView((await searchParams).view);
  const today = todayMyt();

  const [policies, staff, grades] = await Promise.all([
    view === "policies" ? loadPoliciesData() : null,
    view === "staff" ? loadStaffData() : null,
    view === "grades" ? loadGradesData() : null,
  ]);
  const team = await getTeamDirectory();
  const names = new Map(team.map((member) => [member.id, member.name]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="HR"
        description={t(
          "The latest company rules and packages in one place. Only the Managing Director and HR & Accounts can see this page.",
        )}
        actions={
          policies && (
            <PolicyDialog
              replaceable={splitPolicies(policies.documents).current}
              today={today}
            />
          )
        }
      />
      <HrTabs active={view} t={t} />
      {policies ? (
        <PoliciesView
          {...policies}
          showCommissionSettings={canChangeSettings(me)}
          nameOf={(personId) => names.get(personId) ?? t("Unnamed")}
          today={today}
          t={t}
        />
      ) : staff ? (
        <StaffView
          data={staff}
          nameOf={(personId) => names.get(personId) ?? t("Unnamed")}
          today={today}
          t={t}
        />
      ) : grades ? (
        <GradesView
          data={grades}
          nameOf={(personId) => names.get(personId) ?? t("Unnamed")}
          today={today}
          t={t}
        />
      ) : null}
    </div>
  );
}
