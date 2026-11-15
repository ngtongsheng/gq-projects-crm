import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { canChangeSettings, canSeeHr } from "@/lib/auth/job-role";
import { requirePage } from "@/lib/auth/require-page";
import { getTeamDirectory } from "@/lib/auth/team-directory";
import { splitPolicies } from "@/lib/domain/hr-policy";
import { todayMyt } from "@/lib/format/date";
import { getT } from "@/lib/i18n/server-t";
import { HrTabs } from "./hr-tabs";
import { parseHrView } from "./hr-view";
import { PoliciesView } from "./policies-view";
import { loadPoliciesData } from "./policy-data";
import { PolicyDialog } from "./policy-dialog";

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

  const policies = view === "policies" ? await loadPoliciesData() : null;
  const team = policies ? await getTeamDirectory() : [];
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
      ) : (
        <div className="rounded-xl border bg-card">
          <EmptyState title={t("Not built yet")} />
        </div>
      )}
    </div>
  );
}
